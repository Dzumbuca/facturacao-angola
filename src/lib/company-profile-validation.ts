import PDFDocument from 'pdfkit';

const MAX_LOGO_BYTES = 1024 * 1024;

export type CompanyProfileInput = {
  name: string;
  legalName: string | null;
  nif: string | null;
  address: string | null;
  municipality: string | null;
  province: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  iban: string | null;
  brandColor: string | null;
  invoiceFooter: string | null;
  defaultMessage: string | null;
  defaultCurrency: 'AOA';
  documentLanguage: 'pt-AO';
  defaultPaymentDays: number | null;
  defaultPaymentMethod: string | null;
  defaultObservations: string | null;
  logo: File | null;
  removeLogo: boolean;
};

export const validateCompanyProfileInput = async (formData: FormData) => {
  const errors: string[] = [];
  const readText = (fieldName: string, label: string, limit: number, required = false) => {
    const field = formData.get(fieldName);
    if (field === null) return '';
    if (typeof field !== 'string') {
      errors.push(`${label} tem um formato inválido.`);
      return '';
    }

    const value = field.trim();
    if (required && !value) errors.push(`${label} é obrigatório.`);
    if (value.length > limit) errors.push(`${label} deve ter no máximo ${limit} caracteres.`);
    return value;
  };

  const name = readText('name', 'O nome da empresa', 160, true);
  const legalName = readText('legalName', 'A denominação legal', 160) || null;
  const nif = readText('nif', 'O NIF', 32) || null;
  const address = readText('address', 'A morada', 250) || null;
  const municipality = readText('municipality', 'O município', 120) || null;
  const province = readText('province', 'A província', 120) || null;
  const country = readText('country', 'O país', 100) || null;
  const phone = readText('phone', 'O telefone', 40) || null;
  const email = readText('email', 'O email', 254) || null;
  const website = readText('website', 'O website', 200) || null;
  const bankName = readText('bankName', 'O banco', 120) || null;
  const bankAccountName = readText('bankAccountName', 'O titular da conta', 160) || null;
  const iban = readText('iban', 'O IBAN', 34) || null;
  const brandColorInput = readText('brandColor', 'A cor da marca', 7) || '';
  const brandColor = brandColorInput || null;
  const invoiceFooter = readText('invoiceFooter', 'O rodapé da factura', 500) || null;
  const defaultMessage = readText('defaultMessage', 'A mensagem padrão', 1000) || null;
  const defaultObservations = readText('defaultObservations', 'As observações padrão', 2000) || null;
  const currencyValue = readText('defaultCurrency', 'A moeda padrão', 3) || 'AOA';
  const languageValue = readText('documentLanguage', 'O idioma dos documentos', 20) || 'pt-AO';
  const daysValue = readText('defaultPaymentDays', 'O prazo padrão', 8);
  const defaultPaymentDays = daysValue ? Number(daysValue) : null;
  const methodValue = readText('defaultPaymentMethod', 'O método de pagamento padrão', 32) || '';
  const allowedMethods = ['BANK_TRANSFER', 'MULTICAIXA_EXPRESS', 'MULTICAIXA_REFERENCE', 'CASH', 'OTHER'];

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('O email tem um formato inválido.');
  if (website) {
    try {
      const url = new URL(website);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Invalid protocol');
    } catch {
      errors.push('O website deve começar por http:// ou https://.');
    }
  }
  if (brandColor && !/^#[0-9a-fA-F]{6}$/.test(brandColor)) errors.push('A cor da marca deve usar o formato hexadecimal #RRGGBB.');
  if (currencyValue !== 'AOA') errors.push('A moeda disponível nesta versão é AOA.');
  if (languageValue !== 'pt-AO') errors.push('O idioma disponível nesta versão é Português de Angola.');
  if (defaultPaymentDays !== null && (!Number.isInteger(defaultPaymentDays) || defaultPaymentDays < 0 || defaultPaymentDays > 3650)) errors.push('O prazo padrão deve ser um número inteiro entre 0 e 3650 dias.');
  if (methodValue && !allowedMethods.includes(methodValue)) errors.push('O método de pagamento padrão é inválido.');

  const logoField = formData.get('logo');
  const logo = logoField instanceof File && logoField.size > 0 ? logoField : null;
  if (logoField !== null && typeof logoField !== 'string' && !(logoField instanceof File)) {
    errors.push('O logótipo tem um formato inválido.');
  }

  if (logo) {
    if (logo.size > MAX_LOGO_BYTES) errors.push('O logótipo deve ter no máximo 1 MB.');
    if (logo.type !== 'image/png' && logo.type !== 'image/jpeg') {
      errors.push('O logótipo deve estar em formato PNG ou JPEG.');
    } else if (logo.size <= MAX_LOGO_BYTES) {
      const bytes = new Uint8Array(await logo.arrayBuffer());
      const isPng = logo.type === 'image/png'
        && bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
      const isJpeg = logo.type === 'image/jpeg'
        && bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      if (!isPng && !isJpeg) {
        errors.push('O conteúdo do logótipo não corresponde ao formato indicado.');
      } else {
        try {
          const imageDocument = new PDFDocument({ autoFirstPage: false });
          (imageDocument as unknown as { openImage: (source: Buffer) => unknown }).openImage(Buffer.from(bytes));
        } catch {
          errors.push('O ficheiro do logótipo está danificado ou não é uma imagem válida.');
        }
      }
    }
  }

  const removeLogoValue = formData.get('removeLogo');
  const removeLogo = removeLogoValue === 'true';
  if (removeLogoValue !== null && removeLogoValue !== 'true' && removeLogoValue !== 'false') {
    errors.push('A opção de remover o logótipo é inválida.');
  }
  if (removeLogo && logo) errors.push('Escolhe entre carregar um logótipo ou remover o actual.');

  return {
    isValid: errors.length === 0,
    errors,
    value: errors.length ? undefined : {
      name, legalName, nif, address, municipality, province, country, phone, email, website,
      bankName, bankAccountName, iban, brandColor, invoiceFooter, defaultMessage,
      defaultCurrency: 'AOA', documentLanguage: 'pt-AO', defaultPaymentDays,
      defaultPaymentMethod: methodValue || null, defaultObservations, logo, removeLogo,
    } satisfies CompanyProfileInput,
  };
};
