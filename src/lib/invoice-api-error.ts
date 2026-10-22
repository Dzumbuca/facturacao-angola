export const getInvoiceApiErrorMessage = (payload: unknown, fallback = 'Erro ao gerar PDF') => {
  if (!payload || typeof payload !== 'object') return fallback;

  const body = payload as { error?: unknown; warnings?: unknown };
  const messages = [
    body.error,
    ...(Array.isArray(body.warnings) ? body.warnings : []),
  ].filter((message): message is string => typeof message === 'string' && Boolean(message.trim()));

  return messages.join(' ') || fallback;
};

export const getInvoiceServerErrorMessage = (error: unknown) => {
  if (!error || typeof error !== 'object') return 'Não foi possível emitir a fatura. Tente novamente.';

  const failure = error as { name?: unknown; code?: unknown };
  if (
    failure.name === 'PrismaClientInitializationError'
    || (typeof failure.code === 'string' && ['P1000', 'P1001', 'P1002', 'P1003'].includes(failure.code))
  ) {
    return 'A base de dados não está disponível. Inicie o serviço PostgreSQL e tente emitir a fatura novamente.';
  }

  return 'Não foi possível emitir a fatura. Verifique os dados e tente novamente.';
};
