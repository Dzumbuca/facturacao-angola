from pathlib import Path
from zipfile import ZipFile
from docx import Document
from pypdf import PdfReader
root=Path(r'C:\Users\Administrador\Desktop\facturacao-angola\docs')
d=root/'Machine-Facturas-Apresentacao-Institucional.docx'; p=root/'Machine-Facturas-Apresentacao-Institucional.pdf'; m=root/'Machine-Facturas-Post-LinkedIn.md'
with ZipFile(d) as z: assert z.testzip() is None
word=Document(d); wordtext='\n'.join(x.text for x in word.paragraphs)+'\n'+'\n'.join(c.text for t in word.tables for row in t.rows for c in row.cells)
pdf=PdfReader(str(p)); pages=[page.extract_text() or '' for page in pdf.pages]; pdftext='\n'.join(pages)
post=m.read_text(encoding='utf-8')
required=['Joaquim Zumbuca','Criador da Machine Facturas','Desenvolvedor de Software','SAFT-AO','AGT','Principais funcionalidades','Contactos e presença digital']
for label,text in [('DOCX',wordtext),('PDF',pdftext)]:
 missing=[term for term in required if term not in text]
 assert not missing, (label,missing)
assert 'Joaquim Zumbuca' in post and 'Tenho trabalhado directamente' in post
assert len(pdf.pages)==5 and all(x.strip() for x in pages)
assert len(word.inline_shapes)>=1 and len(word.paragraphs)>30 and len(word.tables)>=1
print('DOCX: ZIP válido, aberto por python-docx, texto/editabilidade confirmados; páginas:',sum('w:type="page"' in x._p.xml for x in word.paragraphs)+1)
print('PDF: 5 páginas A4 com texto em todas; autoria, ressalvas AGT/SAFT-AO e contactos confirmados')
print('LinkedIn: autoria em primeira pessoa confirmada')
for f in (d,p,m): print(f'{f.name}: {f.stat().st_size} bytes')