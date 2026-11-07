const fs = require('fs');
const s = fs.readFileSync('prisma/schema.prisma','utf8');
const re = /(model PurchaseOrder|model PurchaseOrderItem|PurchaseOrderItem|purchaseOrderItem)/g;
let m; let i=0;
while((m=re.exec(s)) && i<40){ i++; const start=Math.max(0,m.index-100); console.log(s.slice(start,m.index+150)); console.log('\n===\n'); }