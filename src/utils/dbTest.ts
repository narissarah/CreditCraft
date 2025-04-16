import { prisma } from '../../prisma/client';

/**
 * Tests the database connection by performing a simple query
 * @returns {Promise<boolean>} Whether the connection is successful
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Attempt to query the database
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Tests specific database models by performing basic CRUD operations
 * @returns {Promise<boolean>} Whether all model tests pass
 */
export async function testDatabaseModels(): Promise<boolean> {
  try {
    // Test Customer model
    const testCustomerId = 'test-customer-id';
    
    // Clean up any existing test data
    await prisma.customer.deleteMany({
      where: { id: testCustomerId }
    });
    
    // Create
    const customer = await prisma.customer.create({
      data: {
        id: testCustomerId,
        email: 'test-db-model@example.com',
        firstName: 'Test',
        lastName: 'Customer'
      }
    });
    
    // Read
    const retrievedCustomer = await prisma.customer.findUnique({
      where: { id: testCustomerId }
    });
    
    if (!retrievedCustomer || retrievedCustomer.email !== 'test-db-model@example.com') {
      throw new Error('Customer read test failed');
    }
    
    // Update
    const updatedCustomer = await prisma.customer.update({
      where: { id: testCustomerId },
      data: { firstName: 'Updated' }
    });
    
    if (updatedCustomer.firstName !== 'Updated') {
      throw new Error('Customer update test failed');
    }
    
    // Delete
    await prisma.customer.delete({
      where: { id: testCustomerId }
    });
    
    const deletedCustomer = await prisma.customer.findUnique({
      where: { id: testCustomerId }
    });
    
    if (deletedCustomer) {
      throw new Error('Customer delete test failed');
    }
    
    console.log('✅ Database model tests passed');
    return true;
  } catch (error) {
    console.error('❌ Database model tests failed:', error);
    return false;
  }
}

/**
 * Runs a full database test suite
 * @returns {Promise<boolean>} Whether all tests pass
 */
export async function runDatabaseTests(): Promise<boolean> {
  try {
    const connectionSuccess = await testDatabaseConnection();
    if (!connectionSuccess) return false;
    
    const modelsSuccess = await testDatabaseModels();
    if (!modelsSuccess) return false;
    
    console.log('✅ All database tests passed');
    return true;
  } catch (error) {
    console.error('❌ Database tests failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
} 