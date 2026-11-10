declare module 'qrcode' {
  const QRCode: {
    toString(text: string, options?: Record<string, unknown>): Promise<string>;
    toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
  };
  export default QRCode;
}
