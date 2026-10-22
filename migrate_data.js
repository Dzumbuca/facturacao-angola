const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const prisma = new PrismaClient();
const sqliteDbPath = path.join(__dirname, 'server', 'database.db');
const db = new sqlite3.Database(sqliteDbPath);

async function main() {
    // 1. Create a tenant if none exists
    let tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        tenant = await prisma.tenant.create({
            data: {
                name: 'Empresa Principal'
            }
        });
        console.log('Created tenant:', tenant.id);
    } else {
        console.log('Using tenant:', tenant.id);
    }

    // 2. Fetch products from SQLite
    db.all("SELECT * FROM produtos", async (err, rows) => {
        if (err) { console.error(err); process.exit(1); }
        
        console.log(`Found ${rows.length} products to migrate.`);
        
        for (const row of rows) {
            await prisma.product.create({
                data: {
                    tenantId: tenant.id,
                    name: row.nome,
                    codigo: row.codigo,
                    price: row.preco,
                    stock: row.stock || 0,
                    categoria: row.categoria || 'GERAL'
                }
            });
            console.log(`Migrated product: ${row.nome}`);
        }
        
        db.close();
        process.exit(0);
    });
}

main();