/** Determina o tamanho ideal do número com base no comprimento do texto. */
export const valueFontClass = (value: string) => {
  const len = value.replace(/\s/g, '').length;
  if (len <= 6) return 'text-[30px]';
  if (len <= 9) return 'text-[26px]';
  if (len <= 12) return 'text-[22px]';
  if (len <= 15) return 'text-[19px]';
  return 'text-[16px]';
};

/** Tamanhos maiores para o cartão navy (balance). */
export const balanceFontClass = (value: string) => {
  const len = value.replace(/\s/g, '').length;
  if (len <= 6) return 'text-[42px]';
  if (len <= 9) return 'text-[38px]';
  if (len <= 12) return 'text-[30px]';
  if (len <= 15) return 'text-[26px]';
  if (len <= 18) return 'text-[22px]';
  return 'text-[18px]';
};
