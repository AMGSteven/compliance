// Test script for the RealPhoneValidation Turbo Standard API implementation
import { validatePhoneNumber, checkPhoneCompliance } from './app/lib/real-phone-validation.js';

// Enable more verbose logging
process.env.DEBUG_MODE = 'true';

// Test phone numbers with expected outcomes
const testPhones = [
  // Test case 1: Landline number - should pass
  { number: "8005551212", description: "Standard toll-free number", expectPass: true, expectedType: "Landline" },
  
  // Test case 2: Mobile number - should pass 
  { number: "5125551234", description: "Standard mobile number", expectPass: true, expectedType: "Mobile" },
  
  // Test case 3: VoIP number - should be rejected
  { number: "9295551234", description: "VoIP number", expectPass: false, expectedType: "VoIP" },
  
  // Test case 4: Disconnected number - should be rejected
  { number: "9999999999", description: "Invalid/disconnected number", expectPass: false },
  
  // Test case 5: Invalid format - should be rejected
  { number: "123", description: "Too short", expectPass: false },
  
  // Test case 6: Non-numeric - should be rejected
  { number: "abcdefghij", description: "Non-numeric", expectPass: false },
];

// Test phone validation directly
async function testValidation() {
  console.log("=== TESTING TURBO STANDARD VALIDATION ===");
  
  for (const testCase of testPhones) {
    console.log(`\nTesting phone: ${testCase.number} (${testCase.description})`);
    console.log(`Expected outcome: ${testCase.expectPass ? 'PASS' : 'FAIL'}`);
    if (testCase.expectedType) {
      console.log(`Expected type: ${testCase.expectedType}`);
    }
    
    try {
      const result = await validatePhoneNumber(testCase.number);
      console.log("Valid:", result.isValid);
      console.log("Status:", result.rawStatus);
      console.log("Phone Type:", result.phoneType);
      console.log("Is VoIP:", result.isVoIP);
      
      // Report test results
      if (result.isValid === testCase.expectPass) {
        console.log("✓ TEST PASSED: Validation result matches expected outcome");
      } else {
        console.log("✗ TEST FAILED: Validation result does not match expected outcome");
      }
      
      if (testCase.expectedType && result.phoneType) {
        if (result.phoneType.toLowerCase() === testCase.expectedType.toLowerCase()) {
          console.log("✓ TEST PASSED: Phone type matches expected type");
        } else {
          console.log(`✗ TEST FAILED: Phone type does not match. Expected: ${testCase.expectedType}, Got: ${result.phoneType}`);
        }
      }
      
      if (!result.isValid) {
        console.log("Reject Reason:", result.rejectReason);
      }
    } catch (error) {
      console.error("Error testing:", error);
    }
  }
}

// Test the full compliance check
async function testCompliance() {
  console.log("\n=== TESTING COMPLIANCE CHECK WITH TURBO STANDARD ===");
  
  for (const testCase of testPhones) {
    console.log(`\nTesting compliance for: ${testCase.number} (${testCase.description})`);
    console.log(`Expected outcome: ${testCase.expectPass ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
    
    try {
      const result = await checkPhoneCompliance(testCase.number);
      console.log("Compliant:", result.isCompliant);
      
      // Report test results
      if (result.isCompliant === testCase.expectPass) {
        console.log("✓ TEST PASSED: Compliance result matches expected outcome");
      } else {
        console.log("✗ TEST FAILED: Compliance result does not match expected outcome");
      }
      
      if (!result.isCompliant) {
        console.log("Rejection Reason:", result.reason);
      }
      
      console.log("Details:", JSON.stringify(result.details, null, 2));
    } catch (error) {
      console.error("Error testing compliance:", error);
    }
  }
}

// Run tests
async function runTests() {
  try {
    await testValidation();
    await testCompliance();
    console.log("\nTesting completed!");
  } catch (error) {
    console.error("Error running tests:", error);
  }
}

runTests();
