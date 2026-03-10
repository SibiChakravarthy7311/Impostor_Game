export default function HomePage() {
  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.2em] text-teal-800">Party Game Engine</p>
        <h1 className="text-4xl font-bold">Imposter: Lead Variant</h1>
        <p className="max-w-2xl text-gray-700">
          Host a game, share the QR code, and run live rounds with voting plus lead impostor kills.
        </p>
      </header>

      <div className="card space-y-4">
        <h2 className="text-xl font-semibold">Start A New Game</h2>
        <form action="/api/game/create" method="post" className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-3">
            Host Name
            <input name="hostName" required minLength={2} maxLength={24} className="rounded border border-slate-300 px-3 py-2 bg-white text-black" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Total Impostors
            <input type="number" name="impostorCount" min={1} max={4} defaultValue={2} className="rounded border border-slate-300 px-3 py-2 bg-white text-black" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Vote Timer (sec)
            <input type="number" name="votingSeconds" min={30} max={600} defaultValue={90} className="rounded border border-slate-300 px-3 py-2 bg-white text-black" />
          </label>
          <div className="flex items-end">
            <button className="w-full rounded bg-teal-700 px-4 py-2 font-semibold text-white" type="submit">
              Create Game
            </button>
          </div>
        </form>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold">Join Existing Game</h2>
        <form action="/join" className="flex flex-wrap gap-2">
          <input name="code" placeholder="Join code" className="rounded border border-slate-300 px-3 py-2 uppercase bg-white text-black" required />
          <button className="rounded bg-slate-800 px-4 py-2 text-white" type="submit">Join</button>
        </form>
        <p className="text-sm text-gray-600">Tip: host screen displays a QR code for fast joining.</p>
      </div>

      <p className="text-sm text-gray-600">Need setup details? See README.md and Project_Plan.txt in this repo.</p>
    </section>
  );
}
