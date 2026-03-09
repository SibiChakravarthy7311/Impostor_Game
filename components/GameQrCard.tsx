"use client";

import { QRCodeSVG } from "qrcode.react";

type Props = {
  joinUrl: string;
  joinCode: string;
};

export function GameQrCard({ joinUrl, joinCode }: Props) {
  return (
    <div className="card space-y-3">
      <p className="text-sm uppercase tracking-[0.18em] text-slate-600">Join Code: {joinCode}</p>
      <div className="inline-block rounded bg-white p-3 shadow">
        <QRCodeSVG value={joinUrl} size={172} includeMargin />
      </div>
      <p className="break-all text-xs text-slate-600">{joinUrl}</p>
    </div>
  );
}
