const fs = require('fs');

async function checkDNCStatus(phoneNumber) {
    try {
        const response = await fetch(`http://localhost:3000/api/dialer/dnc?phone=${phoneNumber}&api_key=test_key_123`);
        return await response.json();
    } catch (error) {
        return { phone: phoneNumber, error: error.message };
    }
}

async function verifyDNCBatch(phoneNumbers) {
    const results = { total: phoneNumbers.length, blocked: 0, not_blocked: 0, errors: 0 };
    const notBlockedNumbers = [];
    
    console.log(`🔍 Verifying ${phoneNumbers.length} phone numbers...`);
    
    for (let i = 0; i < phoneNumbers.length; i += 50) {
        const batch = phoneNumbers.slice(i, i + 50);
        const promises = batch.map(phone => checkDNCStatus(phone.trim()));
        
        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(result => {
            if (result.error) {
                results.errors++;
                console.log(`❌ Error checking ${result.phone}: ${result.error}`);
            } else if (result.is_blocked) {
                results.blocked++;
            } else {
                results.not_blocked++;
                notBlockedNumbers.push(result.phone_number || result.phone);
                console.log(`⚠️  NOT BLOCKED: ${result.phone_number || result.phone}`);
            }
        });

        // Progress indicator
        const progress = Math.floor(((i + 50) / phoneNumbers.length) * 100);
        console.log(`Progress: ${progress}% (${results.blocked} blocked, ${results.not_blocked} not blocked)`);
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('\n📊 FINAL RESULTS:');
    console.log(`✅ Total numbers: ${results.total}`);
    console.log(`🔒 Blocked (in DNC): ${results.blocked}`);
    console.log(`🔓 NOT blocked: ${results.not_blocked}`);
    console.log(`❌ Errors: ${results.errors}`);
    
    if (notBlockedNumbers.length > 0) {
        console.log('\n⚠️  Numbers NOT in DNC:');
        notBlockedNumbers.forEach(num => console.log(num));
        
        // Save to file
        fs.writeFileSync('not_blocked_numbers.txt', notBlockedNumbers.join('\n'));
        console.log('\n💾 Not blocked numbers saved to: not_blocked_numbers.txt');
    } else {
        console.log('\n🎉 ALL NUMBERS ARE PROPERLY BLOCKED IN DNC!');
    }
    
    return results;
}

// Read phone numbers from file
function loadPhoneNumbers() {
    try {
        const data = fs.readFileSync('phone_numbers.txt', 'utf8');
        const lines = data.split('\n').map(line => line.trim()).filter(line => line && line !== 'phone_number');
        const validNumbers = lines.filter(phone => /^\d{10}$/.test(phone));
        console.log(`📋 Loaded ${validNumbers.length} valid phone numbers`);
        return validNumbers;
    } catch (error) {
        console.error('Error reading phone_numbers.txt:', error.message);
        return [];
    }
}

// Run verification
const phoneNumbers = loadPhoneNumbers();
if (phoneNumbers.length > 0) {
    verifyDNCBatch(phoneNumbers).then(results => {
        console.log('\n✅ Verification complete!');
    });
} else {
    console.log('No phone numbers found. Please create phone_numbers.txt with your numbers.');
}
