export const getSAFTPeriod = (month?: string | null, year?: string | null, now = new Date()) => {
  const parsedMonth = month == null || month === '' ? now.getMonth() + 1 : Number(month);
  const parsedYear = year == null || year === '' ? now.getFullYear() : Number(year);

  if (!Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    throw new Error('O mês deve estar entre 1 e 12.');
  }
  if (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 9999) {
    throw new Error('O ano é inválido.');
  }

  return { month: parsedMonth, year: parsedYear };
};

export const getSAFTDocumentType = (type: string) => type === 'NC' ? 'NC' : 'FT';
