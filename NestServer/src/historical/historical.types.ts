/**
 * historical.types.ts
 *
 * Tipos del módulo de datos históricos.
 */

/** Vela cruda parseada de la respuesta JSON de TwelveData */
export type RawTwelveDataCandle = {
  datetime: string;
  open:     string;
  high:     string;
  low:      string;
  close:    string;
};

/** Resultado de una descarga */
export type DownloadResult = {
  symbol:        string;
  timeframe:     string;
  newCandles:     number;
  totalInCache:  number;
  pagesDownloaded: number;
};
