const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  console.log('🌱 Seeding database...');

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@databundle.com' },
    update: {},
    create: {
      email: 'admin@databundle.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN'
    }
  });
  console.log('✅ Admin created');

  // Create Test Customer
  const userPassword = await bcrypt.hash('customer123', 10);
  await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      password: userPassword,
      name: 'Test Customer',
      role: 'USER'
    }
  });
  console.log('✅ Customer created');

  // Create Bundles (without validity field)
  const bundles = [
    { name: 'MTN 1GB', network: 'MTN', dataSize: '1GB', costPrice: 3.50, sellingPrice: 4.30, provider: 'RemaData', providerCode: 'MTN-1GB', stock: 100 },
    { name: 'MTN 2GB', network: 'MTN', dataSize: '2GB', costPrice: 6.00, sellingPrice: 8.00, provider: 'RemaData', providerCode: 'MTN-2GB', stock: 100 },
    { name: 'MTN 5GB', network: 'MTN', dataSize: '5GB', costPrice: 12.00, sellingPrice: 15.00, provider: 'RemaData', providerCode: 'MTN-5GB', stock: 100 },
    { name: 'MTN 10GB', network: 'MTN', dataSize: '10GB', costPrice: 20.00, sellingPrice: 25.00, provider: 'RemaData', providerCode: 'MTN-10GB', stock: 100 },
    { name: 'MTN 20GB', network: 'MTN', dataSize: '20GB', costPrice: 35.00, sellingPrice: 45.00, provider: 'RemaData', providerCode: 'MTN-20GB', stock: 100 },
    { name: 'Vodafone 1GB', network: 'VODAFONE', dataSize: '1GB', costPrice: 3.80, sellingPrice: 4.50, provider: 'RemaData', providerCode: 'VOD-1GB', stock: 100 },
    { name: 'Vodafone 3GB', network: 'VODAFONE', dataSize: '3GB', costPrice: 9.00, sellingPrice: 12.00, provider: 'RemaData', providerCode: 'VOD-3GB', stock: 100 },
    { name: 'Vodafone 5GB', network: 'VODAFONE', dataSize: '5GB', costPrice: 14.00, sellingPrice: 18.00, provider: 'RemaData', providerCode: 'VOD-5GB', stock: 100 },
    { name: 'AirtelTigo 1GB', network: 'AIRTELTIGO', dataSize: '1GB', costPrice: 3.20, sellingPrice: 3.99, provider: 'RemaData', providerCode: 'AT-1GB', stock: 100 },
    { name: 'AirtelTigo 3GB', network: 'AIRTELTIGO', dataSize: '3GB', costPrice: 8.00, sellingPrice: 10.00, provider: 'RemaData', providerCode: 'AT-3GB', stock: 100 },
    { name: 'AirtelTigo 5GB', network: 'AIRTELTIGO', dataSize: '5GB', costPrice: 12.00, sellingPrice: 14.99, provider: 'RemaData', providerCode: 'AT-5GB', stock: 100 },
    { name: 'Glo 1GB', network: 'GLO', dataSize: '1GB', costPrice: 3.20, sellingPrice: 4.00, provider: 'RemaData', providerCode: 'GLO-1GB', stock: 100 },
    { name: 'Glo 3GB', network: 'GLO', dataSize: '3GB', costPrice: 8.50, sellingPrice: 11.00, provider: 'RemaData', providerCode: 'GLO-3GB', stock: 100 },
    { name: 'Glo 5GB', network: 'GLO', dataSize: '5GB', costPrice: 12.50, sellingPrice: 16.00, provider: 'RemaData', providerCode: 'GLO-5GB', stock: 100 }
  ];

  for (const bundle of bundles) {
    await prisma.bundle.create({
      data: bundle
    });
  }
  console.log(`✅ Created ${bundles.length} bundles`);

  console.log('\n🎉 Seeding Complete!');
  console.log('📊 Summary:');
  console.log('   - Admin: admin@databundle.com / admin123');
  console.log('   - Customer: customer@example.com / customer123');
  console.log(`   - Bundles: ${bundles.length} bundles`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
