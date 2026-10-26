import type { DeckTheme } from '@truco/game-protocol';
import { type CSSProperties, useState } from 'react';
import { CardFace } from '../../shared/PlayingCard';

const fonts = [
  {
    id: 'jersey10',
    name: 'Jersey 10',
    family: 'Jersey 10',
    weight: 400,
    pixel: true,
    category: 'Pixel · escolhida para o jogo',
    detail: 'Compare o desenho dos números e das figuras em três tamanhos.',
  },
  {
    id: 'tiny5',
    name: 'Tiny5',
    family: 'Comparison Tiny5',
    weight: 400,
    pixel: true,
    category: 'Pixel · candidata',
    detail: 'Compare especialmente 5, 6, Q e J nos cantos das cartas.',
  },
  {
    id: 'micro5',
    name: 'Micro 5',
    family: 'Comparison Micro 5',
    weight: 400,
    pixel: true,
    category: 'Pixel · candidata',
    detail: 'Observe a leitura dos traços menores no tamanho de mesa.',
  },
  {
    id: 'vt323',
    name: 'VT323',
    family: 'Comparison VT323',
    weight: 400,
    pixel: true,
    category: 'Pixel · candidata',
    detail: 'Compare a largura dos valores e a separação entre 5, S e 8.',
  },
  {
    id: 'pixelify',
    weight: 700,
    pixel: true,
    name: 'Pixelify Sans',
    family: 'Pixelify Sans',
    category: 'Pixel · referência',
    detail: 'Desenho pixelado original, sem a substituição especial do 5.',
  },
  {
    id: 'atkinson',
    weight: 700,
    pixel: false,
    name: 'Atkinson Hyperlegible',
    family: 'Comparison Atkinson',
    category: 'Sem serifa',
    detail: 'Compare os contornos do 5, 6 e 9 em tamanhos pequenos.',
  },
  {
    id: 'plex',
    weight: 700,
    pixel: false,
    name: 'IBM Plex Sans Condensed',
    family: 'Comparison Plex',
    category: 'Sem serifa · condensada',
    detail: 'Valores mais estreitos, com espaço para os naipes nos cantos.',
  },
  {
    id: 'slab',
    weight: 700,
    pixel: false,
    name: 'Roboto Slab',
    family: 'Comparison Slab',
    category: 'Serifa marcada',
    detail: 'Hastes e serifas robustas para comparar com um baralho tradicional.',
  },
  {
    id: 'serif',
    weight: 700,
    pixel: false,
    name: 'Source Serif 4',
    family: 'Comparison Serif',
    category: 'Serifa clássica',
    detail: 'Uma alternativa mais clássica para números e figuras.',
  },
  {
    id: 'jersey',
    weight: 700,
    pixel: true,
    name: 'Jersey 25',
    family: 'Jersey 25',
    category: 'Pixel · alternativa',
    detail: 'Outra opção pixelada para comparar a leitura com a referência.',
  },
] as const;
const ranks = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
const suits = [
  { id: 'diamonds', name: 'ouros', symbol: '♦' },
  { id: 'spades', name: 'espadas', symbol: '♠' },
  { id: 'hearts', name: 'copas', symbol: '♥' },
  { id: 'clubs', name: 'paus', symbol: '♣' },
] as const;

export function CardFonts() {
  const [font, setFont] = useState('pixel');
  const [theme, setTheme] = useState<DeckTheme>('classic');
  const [size, setSize] = useState('104');
  const visible = fonts.filter((candidate) =>
    font === 'pixel' ? candidate.pixel : font === 'all' || candidate.id === font,
  );

  return (
    <main
      className="card-font-lab"
      style={{ '--comparison-card-width': `${size}px` } as CSSProperties}
    >
      <header className="font-lab-header">
        <div className="font-lab-eyebrow">
          MANILHA MALDITA <span>PROTÓTIPO VISUAL</span>
        </div>
        <h1>Qual fonte funciona melhor nas cartas?</h1>
        <p>
          Fontes pixel art em destaque, com as 40 cartas do Truco lado a lado. Compare cada fonte no
          mesmo tamanho e tema, com atenção ao <b>5</b> e às letras <b>A, K, Q e J</b>.
        </p>
        <a href="/">← Voltar ao jogo</a>
      </header>
      <fieldset className="font-lab-controls" aria-label="Opções de comparação">
        <label>
          Fonte
          <select value={font} onChange={(event) => setFont(event.target.value)}>
            <option value="pixel">Fontes pixel art · 6 opções</option>
            <option value="all">Todas as fontes · 10 opções</option>
            {fonts.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tema da carta
          <select value={theme} onChange={(event) => setTheme(event.target.value as DeckTheme)}>
            <option value="classic">Clássico</option>
            <option value="ember">Brasa</option>
            <option value="arcane">Arcano</option>
          </select>
        </label>
        <label>
          Tamanho da carta
          <select value={size} onChange={(event) => setSize(event.target.value)}>
            <option value="76">Pequeno · 76 px</option>
            <option value="104">Médio · 104 px</option>
            <option value="136">Grande · 136 px</option>
          </select>
        </label>
      </fieldset>
      <p className="font-lab-note">
        O tema selecionado é aplicado a todas as fontes e cartas. Todas as cartas ficam visíveis por
        fonte. Em telas menores, deslize as fileiras na horizontal. Esta tela não altera a fonte do
        jogo nem sua conta.
      </p>
      {visible.map((candidate) => (
        <section
          className="font-comparison"
          key={candidate.id}
          data-font={candidate.id}
          style={
            {
              '--comparison-font': `"${candidate.family}"`,
              '--comparison-weight': candidate.weight,
            } as CSSProperties
          }
          aria-label={candidate.name}
        >
          <header className="font-comparison-header">
            <div>
              <span className="font-category">{candidate.category}</span>
              <h2>{candidate.name}</h2>
              <p>{candidate.detail}</p>
            </div>
            <div className="font-probe">
              <span>5 S 8</span>
              <small>6 9 · A K Q J</small>
            </div>
          </header>
          <section
            className="font-deck-scroll"
            aria-label={`40 cartas em ${candidate.name}`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: A horizontal scroll region must be keyboard reachable.
            tabIndex={0}
          >
            <div className="font-deck">
              {suits.map((suit) => (
                <div className="font-suit-group" key={suit.id}>
                  <h3>
                    {suit.symbol} {suit.name}
                  </h3>
                  <div className="font-card-row">
                    {ranks.map((rank) => (
                      <div
                        className="font-sample-card"
                        key={rank}
                        role="img"
                        aria-label={`${rank} de ${suit.name}, ${candidate.name}`}
                      >
                        <CardFace card={{ rank, suit: suit.id }} theme={theme} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      ))}
      <footer className="font-lab-footer">
        6 fontes pixel art + 4 alternativas · 40 cartas por fonte · 3 temas · Sem mudanças nas
        regras ou nos desbloqueios
      </footer>
    </main>
  );
}
