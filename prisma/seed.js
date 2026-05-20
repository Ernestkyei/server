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

  // Create Bundles - More options!
  const bundles = [
    // MTN Bundles (1GB to 50GB)
    { name: 'MTN 1GB', network: 'MTN', dataSize: '1GB', costPrice: 3.50, sellingPrice: 4.30, provider: 'RemaData', providerCode: 'MTN-1GB', stock: 100 },
    { name: 'MTN 2GB', network: 'MTN', dataSize: '2GB', costPrice: 6.00, sellingPrice: 8.00, provider: 'RemaData', providerCode: 'MTN-2GB', stock: 100 },
    { name: 'MTN 3GB', network: 'MTN', dataSize: '3GB', costPrice: 8.00, sellingPrice: 11.00, provider: 'RemaData', providerCode: 'MTN-3GB', stock: 100 },
    { name: 'MTN 4GB', network: 'MTN', dataSize: '4GB', costPrice: 10.00, sellingPrice: 13.00, provider: 'RemaData', providerCode: 'MTN-4GB', stock: 100 },
    { name: 'MTN 5GB', network: 'MTN', dataSize: '5GB', costPrice: 12.00, sellingPrice: 15.00, provider: 'RemaData', providerCode: 'MTN-5GB', stock: 100 },
    { name: 'MTN 6GB', network: 'MTN', dataSize: '6GB', costPrice: 14.00, sellingPrice: 18.00, provider: 'RemaData', providerCode: 'MTN-6GB', stock: 100 },
    { name: 'MTN 8GB', network: 'MTN', dataSize: '8GB', costPrice: 16.00, sellingPrice: 21.00, provider: 'RemaData', providerCode: 'MTN-8GB', stock: 100 },
    { name: 'MTN 10GB', network: 'MTN', dataSize: '10GB', costPrice: 20.00, sellingPrice: 25.00, provider: 'RemaData', providerCode: 'MTN-10GB', stock: 100 },
    { name: 'MTN 15GB', network: 'MTN', dataSize: '15GB', costPrice: 28.00, sellingPrice: 35.00, provider: 'RemaData', providerCode: 'MTN-15GB', stock: 100 },
    { name: 'MTN 20GB', network: 'MTN', dataSize: '20GB', costPrice: 35.00, sellingPrice: 45.00, provider: 'RemaData', providerCode: 'MTN-20GB', stock: 100 },
    { name: 'MTN 25GB', network: 'MTN', dataSize: '25GB', costPrice: 42.00, sellingPrice: 55.00, provider: 'RemaData', providerCode: 'MTN-25GB', stock: 100 },
    { name: 'MTN 30GB', network: 'MTN', dataSize: '30GB', costPrice: 50.00, sellingPrice: 65.00, provider: 'RemaData', providerCode: 'MTN-30GB', stock: 100 },
    { name: 'MTN 40GB', network: 'MTN', dataSize: '40GB', costPrice: 65.00, sellingPrice: 85.00, provider: 'RemaData', providerCode: 'MTN-40GB', stock: 100 },
    { name: 'MTN 50GB', network: 'MTN', dataSize: '50GB', costPrice: 80.00, sellingPrice: 105.00, provider: 'RemaData', providerCode: 'MTN-50GB', stock: 100 },
    { name: 'MTN 100GB', network: 'MTN', dataSize: '100GB', costPrice: 150.00, sellingPrice: 195.00, provider: 'RemaData', providerCode: 'MTN-100GB', stock: 100 },

    // Vodafone Bundles
    { name: 'Vodafone 1GB', network: 'VODAFONE', dataSize: '1GB', costPrice: 3.80, sellingPrice: 4.50, provider: 'RemaData', providerCode: 'VOD-1GB', stock: 100 },
    { name: 'Vodafone 2GB', network: 'VODAFONE', dataSize: '2GB', costPrice: 6.50, sellingPrice: 8.50, provider: 'RemaData', providerCode: 'VOD-2GB', stock: 100 },
    { name: 'Vodafone 3GB', network: 'VODAFONE', dataSize: '3GB', costPrice: 9.00, sellingPrice: 12.00, provider: 'RemaData', providerCode: 'VOD-3GB', stock: 100 },
    { name: 'Vodafone 5GB', network: 'VODAFONE', dataSize: '5GB', costPrice: 14.00, sellingPrice: 18.00, provider: 'RemaData', providerCode: 'VOD-5GB', stock: 100 },
    { name: 'Vodafone 10GB', network: 'VODAFONE', dataSize: '10GB', costPrice: 25.00, sellingPrice: 32.00, provider: 'RemaData', providerCode: 'VOD-10GB', stock: 100 },
    { name: 'Vodafone 15GB', network: 'VODAFONE', dataSize: '15GB', costPrice: 35.00, sellingPrice: 45.00, provider: 'RemaData', providerCode: 'VOD-15GB', stock: 100 },
    { name: 'Vodafone 20GB', network: 'VODAFONE', dataSize: '20GB', costPrice: 45.00, sellingPrice: 58.00, provider: 'RemaData', providerCode: 'VOD-20GB', stock: 100 },
    { name: 'Vodafone 30GB', network: 'VODAFONE', dataSize: '30GB', costPrice: 65.00, sellingPrice: 85.00, provider: 'RemaData', providerCode: 'VOD-30GB', stock: 100 },
    { name: 'Vodafone 50GB', network: 'VODAFONE', dataSize: '50GB', costPrice: 100.00, sellingPrice: 130.00, provider: 'RemaData', providerCode: 'VOD-50GB', stock: 100 },

    // AirtelTigo Bundles
    { name: 'AirtelTigo 1GB', network: 'AIRTELTIGO', dataSize: '1GB', costPrice: 3.20, sellingPrice: 3.99, provider: 'RemaData', providerCode: 'AT-1GB', stock: 100 },
    { name: 'AirtelTigo 2GB', network: 'AIRTELTIGO', dataSize: '2GB', costPrice: 5.50, sellingPrice: 7.00, provider: 'RemaData', providerCode: 'AT-2GB', stock: 100 },
    { name: 'AirtelTigo 3GB', network: 'AIRTELTIGO', dataSize: '3GB', costPrice: 8.00, sellingPrice: 10.00, provider: 'RemaData', providerCode: 'AT-3GB', stock: 100 },
    { name: 'AirtelTigo 5GB', network: 'AIRTELTIGO', dataSize: '5GB', costPrice: 12.00, sellingPrice: 14.99, provider: 'RemaData', providerCode: 'AT-5GB', stock: 100 },
    { name: 'AirtelTigo 10GB', network: 'AIRTELTIGO', dataSize: '10GB', costPrice: 20.00, sellingPrice: 25.00, provider: 'RemaData', providerCode: 'AT-10GB', stock: 100 },
    { name: 'AirtelTigo 15GB', network: 'AIRTELTIGO', dataSize: '15GB', costPrice: 28.00, sellingPrice: 35.00, provider: 'RemaData', providerCode: 'AT-15GB', stock: 100 },
    { name: 'AirtelTigo 20GB', network: 'AIRTELTIGO', dataSize: '20GB', costPrice: 35.00, sellingPrice: 45.00, provider: 'RemaData', providerCode: 'AT-20GB', stock: 100 },

    // Glo Bundles
    { name: 'Glo 1GB', network: 'GLO', dataSize: '1GB', costPrice: 3.20, sellingPrice: 4.00, provider: 'RemaData', providerCode: 'GLO-1GB', stock: 100 },
    { name: 'Glo 2GB', network: 'GLO', dataSize: '2GB', costPrice: 5.50, sellingPrice: 7.00, provider: 'RemaData', providerCode: 'GLO-2GB', stock: 100 },
    { name: 'Glo 3GB', network: 'GLO', dataSize: '3GB', costPrice: 8.50, sellingPrice: 11.00, provider: 'RemaData', providerCode: 'GLO-3GB', stock: 100 },
    { name: 'Glo 5GB', network: 'GLO', dataSize: '5GB', costPrice: 12.50, sellingPrice: 16.00, provider: 'RemaData', providerCode: 'GLO-5GB', stock: 100 },
    { name: 'Glo 10GB', network: 'GLO', dataSize: '10GB', costPrice: 22.00, sellingPrice: 28.00, provider: 'RemaData', providerCode: 'GLO-10GB', stock: 100 },
    { name: 'Glo 15GB', network: 'GLO', dataSize: '15GB', costPrice: 30.00, sellingPrice: 38.00, provider: 'RemaData', providerCode: 'GLO-15GB', stock: 100 },
    { name: 'Glo 20GB', network: 'GLO', dataSize: '20GB', costPrice: 38.00, sellingPrice: 48.00, provider: 'RemaData', providerCode: 'GLO-20GB', stock: 100 }
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
  console.log('\n📦 Bundle Breakdown:');
  console.log('   - MTN: 15 bundles (1GB - 100GB)');
  console.log('   - Vodafone: 9 bundles (1GB - 50GB)');
  console.log('   - AirtelTigo: 7 bundles (1GB - 20GB)');
  console.log('   - Glo: 7 bundles (1GB - 20GB)');
  console.log('   - Total: 38 bundles');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
