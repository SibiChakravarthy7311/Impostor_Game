export default async function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-[0.18em] text-teal-800">Game Join</p>
        <h1 className="text-3xl font-bold">Code: {code}</h1>
      </header>

      <form action="/api/game/join" method="post" className="card max-w-md space-y-3">
        <input type="hidden" name="joinCode" value={code} />
        <label className="flex flex-col gap-1 text-sm">
          Your Name
          <input
            name="playerName"
            minLength={2}
            maxLength={24}
            required
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button className="rounded bg-teal-700 px-4 py-2 font-semibold text-white" type="submit">
          Join Game
        </button>
      </form>
    </section>
  );
}
