const { PrismaClient } = require('@prisma/client');

async function testLeadExport() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing lead export...');
    
    // Check total leads
    const totalLeads = await prisma.leads.count();
    console.log(`Total leads in database: ${totalLeads}`);
    
    // Check list IDs
    const listIds = await prisma.$queryRaw`
      SELECT DISTINCT list_id, COUNT(*) as count 
      FROM leads 
      WHERE list_id IS NOT NULL 
      GROUP BY list_id 
      ORDER BY count DESC 
      LIMIT 20
    `;
    
    console.log('List IDs with lead counts:');
    listIds.forEach(row => {
      console.log(`  ${row.list_id}: ${row.count} leads`);
    });
    
    // Test a sample query
    if (listIds.length > 0) {
      const sampleListId = listIds[0].list_id;
      console.log(`\nTesting export for list ID: ${sampleListId}`);
      
      const sampleLeads = await prisma.$queryRaw`
        SELECT id, list_id, first_name, last_name, email, phone, created_at
        FROM leads 
        WHERE list_id = ${sampleListId}
        LIMIT 5
      `;
      
      console.log(`Sample leads for ${sampleListId}:`, sampleLeads);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLeadExport();
