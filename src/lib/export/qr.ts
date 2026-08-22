import QRCode from 'qrcode';

/**
 * QR codes always encode the ORIGINAL article/document URL so a reader of a
 * PNG card or a slide can reach the publisher's own page.
 */
export async function qrPngBuffer(url: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b3d2c', light: '#ffffff' },
  });
}

export async function qrDataUrl(url: string, size = 512): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0b3d2c', light: '#ffffff' },
  });
}
