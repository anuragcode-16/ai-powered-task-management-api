// uuid.js  – ultra-small random hex generator
export function v4 () {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  return [...buf].map(b => b.toString(16).padStart(2,'0')).join('');
}