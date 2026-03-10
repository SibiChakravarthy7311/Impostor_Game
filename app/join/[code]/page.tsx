import { CharacterSelector } from "../../../components/CharacterSelector";
import { JoinGameForm } from "../../../components/JoinGameForm";

export default async function JoinByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-[0.18em] text-cyan-400">Game Join</p>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Code: {code}
        </h1>
      </header>

      <JoinGameForm joinCode={code} />
    </section>
  );
}
