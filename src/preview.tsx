import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import uiCss from './ui/ui.module.css?inline';
import tokenCss from './styles/tokens.css?inline';
import './styles/preview.css';

function Canvas() {
  return <main className="canvas"><header className="site-nav"><a className="site-brand" href="#">form<span> & </span>field</a><nav><a href="#collection">Collection</a><a href="#story">Our story</a><span className="site-cart">Bag (0)</span></nav></header><section className="hero" id="collection"><div className="hero-copy"><div className="eyebrow">FEWER THINGS. BETTER THINGS.</div><h1>Make space<br />for good ideas.</h1><p>Thoughtful objects for a considered everyday.<br />Made to belong, built to stay.</p><a className="explore" href="#story">Explore the collection <span>↗</span></a><div className="edition"><span>01 / 03</span><i /><span>THE EVERYDAY EDIT</span></div></div><div className="still-life" aria-label="Sculptural objects in warm light"><div className="halo"/><div className="plinth"/><div className="vase"><div className="vase-mouth"/></div><div className="orb"/><div className="book book-one"/><div className="book book-two"/><div className="art-caption">Objects with intention.<span>EST. 2024 — COPENHAGEN</span></div></div><div className="selection-outline"><span>div.hero-card <b>993 × 585.88</b></span><i/><i/><i/><i/></div></section><footer id="story"><span>Designed for the way you live.</span><span>CSSForge · Phase 01 fixture canvas</span></footer></main>;
}
createRoot(document.getElementById('canvas')!).render(<Canvas />);
const host = document.createElement('cssforge-ui');
document.body.append(host);
const shadow = host.attachShadow({ mode: 'open' });
const style = document.createElement('style');
style.textContent = tokenCss + uiCss;
const container = document.createElement('div');
shadow.append(style, container);
createRoot(container).render(<App />);
