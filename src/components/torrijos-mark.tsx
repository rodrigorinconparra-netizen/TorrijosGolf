/* eslint-disable @next/next/no-img-element */

/**
 * Marca del club: el logo real de Torrijos Golf (golfista + wordmark en teal).
 * El PNG tiene mucho aire alrededor, así que lo recortamos con un contenedor.
 */
export function TorrijosMark({ height = 34 }: { height?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Torrijos Golf"
      style={{ height, width: "auto" }}
      className="select-none"
      draggable={false}
    />
  );
}
