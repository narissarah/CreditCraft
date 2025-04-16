const fs = require('fs');
const path = require('path');

// Paths
const mainSchemaPath = path.join(__dirname, '../prisma/schema.prisma');
const emailSchemaPath = path.join(__dirname, '../prisma/schema-email.prisma');
const backupSchemaPath = path.join(__dirname, '../prisma/schema.prisma.bak');

// Read schema files
console.log('Reading schemas...');
const mainSchema = fs.readFileSync(mainSchemaPath, 'utf8');
const emailSchema = fs.readFileSync(emailSchemaPath, 'utf8');

// Create backup of current schema
console.log('Creating backup of current schema...');
fs.writeFileSync(backupSchemaPath, mainSchema);

// Check if email schema models already exist in main schema
if (mainSchema.includes('model EmailLog')) {
  console.log('Email schema models already exist in main schema. Skipping update.');
  process.exit(0);
}

// Find Customer model to add relation
const customerModelMatch = mainSchema.match(/model\s+Customer\s+{[\s\S]*?}/);
if (!customerModelMatch) {
  console.log('Error: Could not find Customer model in schema');
  process.exit(1);
}

// Extract Customer model
const customerModel = customerModelMatch[0];

// Check if NotificationPreference relation already exists
if (customerModel.includes('notificationPreferences')) {
  console.log('NotificationPreference relation already exists in Customer model. Skipping relation update.');
} else {
  // Add relation to Customer model
  const updatedCustomerModel = customerModel.replace(
    /}$/,
    '\n  notificationPreferences NotificationPreference?\n}'
  );

  // Replace Customer model in main schema
  const updatedMainSchema = mainSchema.replace(customerModel, updatedCustomerModel);

  // Append email schema
  const finalSchema = updatedMainSchema + '\n\n' + emailSchema;

  // Write updated schema
  console.log('Writing updated schema...');
  fs.writeFileSync(mainSchemaPath, finalSchema);
}

console.log('Schema updated successfully!');
console.log('Run "npm run prisma:migrate" to apply the changes to the database.'); 