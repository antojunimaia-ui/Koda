import AnsiConverter from 'ansi-to-html'

// Singleton ANSI → HTML converter used across message components
const ansi = new AnsiConverter({
  fg: '#CCC',
  bg: '#000',
  newline: false,  // Prevents double spacing since we split lines
  escapeXML: true,
  stream: false,   // Process each line independently
})

export default ansi
