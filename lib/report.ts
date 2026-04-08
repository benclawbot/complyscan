
export function generateReportHTML(data:any){
  return `
  <html>
  <body>
    <h1>GDPR Report for ${data.url}</h1>
    <h2>Score: ${data.score}</h2>
    <p>Risk: ${data.risk}</p>
  </body>
  </html>
  `;
}
