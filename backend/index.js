import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import OpenAI from 'openai';
import multer from 'multer';
import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';
import puppeteer from 'puppeteer';

// ---------- resolve __dirname ----------
const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

// ---------- DB ----------
const dbDir = path.resolve( __dirname, '../db' );
if( !fs.existsSync( dbDir ) ) fs.mkdirSync( dbDir, { recursive: true } );

let db;
async function ensureDb() {
  db = await open( { filename: path.join( dbDir, 'brd.db' ), driver: sqlite3.Database } );
  await db.exec( `
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS brd_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brd_id INTEGER,
      title TEXT,
      description TEXT,
      acceptance_criteria TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
await ensureDb();

async function latestBrdRow() {
  const row = await db.get( `SELECT * FROM brd_versions ORDER BY created_at DESC, id DESC LIMIT 1` );
  return row || null;
}
async function latestBrdText() {
  const row = await latestBrdRow();
  return row?.content || '';
}
async function listStories() {
  const rows = await db.all( `SELECT title, description, acceptance_criteria FROM user_stories ORDER BY id ASC` );
  return rows || [];
}

// ---------- Helpers (API key / model / language from headers) ----------
function getKeyFromReq( req ) {
  const hdr = req.headers[ 'x-api-key' ];
  return ( typeof hdr === 'string' && hdr.trim() ) ? hdr.trim() : process.env.OPENAI_API_KEY;
}
function getModelFromReq( req ) {
  const hdr = req.headers[ 'x-model' ];
  return ( typeof hdr === 'string' && hdr.trim() ) ? hdr.trim() : 'gpt-4.1-mini';
}
function getLangFromReq( req ) {
  const hdr = req.headers[ 'x-lang' ];
  if( hdr === 'ar' || hdr === 'en' ) return hdr;
  return 'auto';
}
function langLabel( lang ) {
  if( lang === 'en' ) return 'English';
  return 'Arabic';
}
function getClient( req, res ) {
  const key = getKeyFromReq( req );
  if( !key ) {
    res.status( 500 ).json( { error: 'No OpenAI API key (env or x-api-key)' } );
    return null;
  }
  return new OpenAI( { apiKey: key } );
}

// ---------- App ----------
const app = express();
app.use( cors( {
  origin: true,
  allowedHeaders: [ 'Content-Type', 'x-api-key', 'x-model', 'x-lang' ],
  exposedHeaders: [ 'Content-Disposition' ],
} ) );
app.use( bodyParser.json( { limit: '10mb' } ) );

// uploads
const upload = multer( { storage: multer.memoryStorage() } );

// صحة
app.get( '/', ( _req, res ) => res.json( { ok: true, service: 'BRD backend' } ) );

// ---------- Upload BRD ----------
app.post( '/upload', upload.single( 'file' ), async ( req, res ) => {
  try {
    const file = req.file;
    if( !file ) return res.status( 400 ).json( { error: 'No file uploaded' } );

    let text = '';
    if( file.mimetype === 'application/pdf' ) {
      text = ( await pdf( file.buffer ) ).text;
    } else if(
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      text = ( await mammoth.extractRawText( { buffer: file.buffer } ) ).value;
    } else {
      text = file.buffer.toString( 'utf-8' );
    }

    await db.run(
      'INSERT INTO brd_versions (version, content) VALUES (?, ?)',
      [ 'v' + Date.now(), text ]
    );

    res.json( { success: true, message: 'BRD uploaded and stored!' } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Failed to process file' } );
  }
} );

// ---------- Chat (SSE) ----------
app.post( '/chat-stream', async ( req, res ) => {
  try {
    const client = getClient( req, res ); if( !client ) return;

    const { message } = req.body ?? {};
    if( !message ) return res.status( 400 ).json( { error: 'message is required' } );

    const model = getModelFromReq( req );
    const lang = getLangFromReq( req );
    const brd = await latestBrdText();

    // SSE headers
    res.setHeader( 'Content-Type', 'text/event-stream; charset=utf-8' );
    res.setHeader( 'Cache-Control', 'no-cache, no-transform' );
    res.setHeader( 'Connection', 'keep-alive' );
    res.flushHeaders?.();

    const langLine =
      lang === 'ar' ? 'Answer in Arabic.' :
        lang === 'en' ? 'Answer in English.' :
          'Answer in the same language of the user.';

    const systemPrompt =
      `You are a senior BA assistant.\n` +
      `You have access to the following BRD context (may be empty):\n` +
      `"""${ brd?.slice( 0, 15000 ) || 'NO_BRD_UPLOADED' }"""\n` +
      `Answer based ONLY on the BRD when the user asks about its content.\n` +
      `If info is missing, say you don't have it and suggest to upload/clarify.\n` +
      `${ langLine }`;

    const stream = await client.chat.completions.create( {
      model,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    } );

    for await( const part of stream ) {
      const delta = part?.choices?.[ 0 ]?.delta?.content;
      if( delta ) res.write( `data: ${ JSON.stringify( delta ) }\n\n` );
    }
    res.write( `data: ${ JSON.stringify( "[DONE]" ) }\n\n` );
    res.end();
  } catch( e ) {
    console.error( e );
    try { res.write( `data: ${ JSON.stringify( 'حدث خطأ أثناء المعالجة.' ) }\n\n` ); } catch {}
    res.end();
  }
} );

// ---------- Summarize ----------
app.post( '/summarize', async ( req, res ) => {
  try {
    const client = getClient( req, res ); if( !client ) return;

    const brd = await latestBrdText();
    if( !brd ) return res.status( 404 ).json( { error: 'No BRD uploaded yet' } );

    const model = getModelFromReq( req );
    const label = langLabel( getLangFromReq( req ) );

    const r = await client.chat.completions.create( {
      model,
      messages: [
        { role: 'system', content: `Summarize the BRD in ${ label } bullets (max 10).` },
        { role: 'user', content: brd.slice( 0, 15000 ) },
      ],
    } );
    const summary = r.choices?.[ 0 ]?.message?.content || 'لم أستطع التلخيص.';
    res.json( { summary } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Summarize failed' } );
  }
} );

// ---------- Generate Stories ----------
app.post( '/stories/generate', async ( req, res ) => {
  try {
    const client = getClient( req, res ); if( !client ) return;

    const brd = await latestBrdText();
    if( !brd ) return res.status( 404 ).json( { error: 'No BRD uploaded yet' } );

    const model = getModelFromReq( req );
    const label = langLabel( getLangFromReq( req ) );

    const r = await client.chat.completions.create( {
      model,
      messages: [
        {
          role: 'system',
          content:
            `Generate user stories JSON array. Keys: title, description, acceptance_criteria. Language: ${ label }.`,
        },
        { role: 'user', content: brd.slice( 0, 15000 ) },
      ],
      response_format: { type: 'json_object' },
    } );

    let parsed = { stories: [] };
    try {
      parsed = JSON.parse( r.choices?.[ 0 ]?.message?.content || '{"stories":[] }' );
    } catch {}
    const stories = Array.isArray( parsed.stories ) ? parsed.stories : [];

    // store (overwrite simple)
    const row = await latestBrdRow();
    const brd_id = row?.id ?? null;
    await db.run( 'DELETE FROM user_stories' );
    for( const s of stories ) {
      await db.run(
        `INSERT INTO user_stories (brd_id, title, description, acceptance_criteria)
         VALUES (?, ?, ?, ?)`,
        [ brd_id, s.title || '', s.description || '', s.acceptance_criteria || '' ]
      );
    }

    res.json( { stories } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Stories generation failed' } );
  }
} );

// ---------- Stories (GET) ----------
app.get( '/stories', async ( _req, res ) => {
  try {
    const rows = await db.all( `SELECT id, title, description, acceptance_criteria FROM user_stories ORDER BY id ASC` );
    res.json( { stories: rows } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { stories: [] } );
  }
} );

// ---------- Insights ----------
app.get( '/insights', async ( req, res ) => {
  try {
    const key = getKeyFromReq( req );
    if( !key ) return res.json( { gaps: [], risks: [], metrics: [] } );
    const brd = await latestBrdText();
    if( !brd ) return res.json( { gaps: [], risks: [], metrics: [] } );

    const client = new OpenAI( { apiKey: key } );
    const model = getModelFromReq( req );
    const label = langLabel( getLangFromReq( req ) );

    const r = await client.chat.completions.create( {
      model,
      messages: [
        {
          role: 'system',
          content:
            `Extract three lists (JSON): gaps, risks, metrics from this BRD; each 0-5 short ${ label } items.`,
        },
        { role: 'user', content: brd.slice( 0, 12000 ) },
      ],
      response_format: { type: 'json_object' },
    } );

    let data = { gaps: [], risks: [], metrics: [] };
    try { data = JSON.parse( r.choices?.[ 0 ]?.message?.content || '{}' ); } catch {}
    data.gaps = Array.isArray( data.gaps ) ? data.gaps : [];
    data.risks = Array.isArray( data.risks ) ? data.risks : [];
    data.metrics = Array.isArray( data.metrics ) ? data.metrics : [];
    res.json( data );
  } catch( e ) {
    console.error( e );
    res.json( { gaps: [], risks: [], metrics: [] } );
  }
} );

// ---------- Status (has BRD? stories count?) ----------
app.get( '/status', async ( _req, res ) => {
  try {
    const brd = await latestBrdRow();
    const cnt = await db.get( 'SELECT COUNT(*) AS c FROM user_stories' );
    res.json( {
      hasBrd: !!brd,
      storyCount: cnt?.c ?? 0,
      lastUploadedAt: brd?.created_at ?? null
    } );
  } catch( e ) {
    res.json( { hasBrd: false, storyCount: 0, lastUploadedAt: null } );
  }
} );

// ---------- Patch BRD ----------
app.post( '/brd/patch', async ( req, res ) => {
  try {
    const client = getClient( req, res ); if( !client ) return;

    const { section, instruction } = req.body ?? {};
    const brd = await latestBrdText();
    if( !brd ) return res.status( 404 ).json( { error: 'No BRD uploaded yet' } );
    if( !section || !instruction ) return res.status( 400 ).json( { error: 'section & instruction are required' } );

    const model = getModelFromReq( req );

    const r = await client.chat.completions.create( {
      model,
      messages: [
        {
          role: 'system',
          content:
            'You will patch the given BRD. Output ONLY the full updated BRD (no comments). Language: keep the original.',
        },
        { role: 'user', content: `BRD:\n"""${ brd.slice( 0, 15000 ) }"""` },
        { role: 'user', content: `Patch section "${ section }" as follows:\n${ instruction }` },
      ],
    } );

    const patched = r.choices?.[ 0 ]?.message?.content || brd;
    await db.run( 'INSERT INTO brd_versions (version, content) VALUES (?, ?)', [ 'patched-' + Date.now(), patched ] );
    res.json( { patched: true } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Patch failed' } );
  }
} );

// ---------- Append ----------
app.post( '/brd/append', async ( req, res ) => {
  try {
    const client = getClient( req, res ); if( !client ) return;

    const { type, content } = req.body ?? {};
    const brd = await latestBrdText();
    if( !brd ) return res.status( 404 ).json( { error: 'No BRD uploaded yet' } );
    if( !content ) return res.status( 400 ).json( { error: 'content is required' } );

    if( type === 'story' ) {
      await db.run(
        `INSERT INTO user_stories (brd_id, title, description, acceptance_criteria)
         VALUES (?, ?, ?, ?)`,
        [ ( await latestBrdRow() )?.id ?? null, content, '', '' ]
      );
      return res.json( { ok: true } );
    }

    const model = getModelFromReq( req );

    const r = await client.chat.completions.create( {
      model,
      messages: [
        {
          role: 'system',
          content:
            'Append the following feature to the BRD in the correct section (create a section if needed). Output ONLY the full updated BRD.',
        },
        { role: 'user', content: `BRD:\n"""${ brd.slice( 0, 14000 ) }"""` },
        { role: 'user', content: `FEATURE:\n${ content }` },
      ],
    } );

    const updated = r.choices?.[ 0 ]?.message?.content || brd + `\n\nFeature:\n${ content }`;
    await db.run( 'INSERT INTO brd_versions (version, content) VALUES (?, ?)', [ 'append-' + Date.now(), updated ] );
    res.json( { ok: true } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Append failed' } );
  }
} );

// ---------- Export DOCX ----------
app.get( '/export/docx', async ( _req, res ) => {
  try {
    const brd = await latestBrdText();
    const stories = await listStories();

    const doc = new Document( {
      sections: [ {
        properties: {},
        children: [
          new Paragraph( { text: 'BRD Export', heading: HeadingLevel.TITLE } ),
          new Paragraph( { text: '' } ),
          new Paragraph( { text: '--- BRD Content ---', heading: HeadingLevel.HEADING_2 } ),
          new Paragraph( { text: brd || 'No BRD uploaded yet.' } ),
          new Paragraph( { text: '' } ),
          new Paragraph( { text: '--- User Stories ---', heading: HeadingLevel.HEADING_2 } ),
          ...( stories.length ? stories.flatMap( ( s, idx ) => ( [
            new Paragraph( { text: `${ idx + 1 }) ${ s.title || 'Untitled' }`, heading: HeadingLevel.HEADING_3 } ),
            s.description ? new Paragraph( { text: `Description: ${ s.description }` } ) : new Paragraph( { text: '' } ),
            s.acceptance_criteria ? new Paragraph( { text: `AC: ${ s.acceptance_criteria }` } ) : new Paragraph( { text: '' } ),
            new Paragraph( { text: '' } ),
          ] ) ) : [ new Paragraph( { text: 'No stories yet.' } ) ] ),
        ],
      } ],
    } );

    const buffer = await Packer.toBuffer( doc );
    res.setHeader( 'Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
    res.setHeader( 'Content-Disposition', 'attachment; filename="brd.docx"' );
    res.send( buffer );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'DOCX export failed' } );
  }
} );

// ---------- Export PDF (Puppeteer + RTL + Arabic font) ----------
function htmlEscape( s = '' ) {
  return s
    .replace( /&/g, '&amp;' ).replace( /</g, '&lt;' )
    .replace( />/g, '&gt;' ).replace( /"/g, '&quot;' )
    .replace( /'/g, '&#39;' );
}

app.get( '/export/pdf', async ( req, res ) => {
  try {
    const brd = await latestBrdText();
    const stories = await listStories();

    const lang = getLangFromReq( req );
    const rtl = lang !== 'en';

    // Optional embedded font for Arabic
    const fontPath = path.resolve( __dirname, 'fonts/NotoNaskhArabic-Regular.ttf' );
    let fontBase64 = '';
    try { fontBase64 = fs.readFileSync( fontPath ).toString( 'base64' ); } catch {}

    const html = `
<!doctype html>
<html lang="${ rtl ? 'ar' : 'en' }" dir="${ rtl ? 'rtl' : 'ltr' }">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @font-face {
    font-family: "NotoNaskhArabic";
    src: url(data:font/ttf;base64,${ fontBase64 }) format("truetype");
    font-weight: normal; font-style: normal; font-display: swap;
  }
  :root{ --fg:#0f172a; --muted:#475569; --line:#e2e8f0; }
  body{
    font-family:${ rtl ? 'NotoNaskhArabic, ' : '' }system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color:var(--fg); margin:24px;
  }
  h1{ font-size:22px; margin:0 0 12px; }
  h2{ font-size:16px; margin:18px 0 8px; }
  .card{ border:1px solid var(--line); border-radius:12px; padding:16px; margin:10px 0; }
  pre{ background:#111827; color:#e5e7eb; padding:12px; border-radius:8px; overflow:auto; }
  .small{ color:var(--muted); font-size:12px; }
  .ac{ color:#0369a1; }
</style>
</head>
<body>
  <h1>BRD Export</h1>
  <div class="card">
    <h2>BRD</h2>
    <div style="white-space:pre-wrap; line-height:1.6">${ htmlEscape( brd || 'No BRD uploaded yet.' ) }</div>
  </div>

  <div class="card">
    <h2>User Stories</h2>
    ${ stories.length
        ? stories.map( ( s, i ) => `
          <div style="margin:0 0 12px 0">
            <strong>${ i + 1 }) ${ htmlEscape( s.title || 'Untitled' ) }</strong><br/>
            ${ s.description ? `<div class="small">${ htmlEscape( s.description ) }</div>` : '' }
            ${ s.acceptance_criteria ? `<div class="small ac">AC: ${ htmlEscape( s.acceptance_criteria ) }</div>` : '' }
          </div>
        `).join( "" )
        : `<div class="small">No stories yet.</div>`
      }
  </div>
</body>
</html>`;

    res.setHeader( 'Content-Type', 'application/pdf' );
    res.setHeader( 'Content-Disposition', 'attachment; filename="brd.pdf"' );

    const browser = await puppeteer.launch( { headless: 'new', args: [ '--no-sandbox' ] } );
    const page = await browser.newPage();
    await page.setContent( html, { waitUntil: 'networkidle0' } );
    const buffer = await page.pdf( {
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
      preferCSSPageSize: true,
    } );
    await browser.close();
    res.send( buffer );
  } catch( e ) {
    console.error( e );
    try { res.end(); } catch {}
  }
} );

// ---------- Generate Flowchart ----------
app.post( '/generate-flowchart', async ( req, res ) => {
  try {
    const client = getClient( req, res ); if( !client ) return;

    const { stories } = req.body ?? {};
    if( !stories || !Array.isArray( stories ) || !stories.length )
      return res.status( 400 ).json( { error: 'Stories required' } );

    const prompt =
      `حول هذه الستوريز إلى كود Mermaid لرسم فلو تشارت يمثل تسلسل العمليات بينهم. استخدم اللغة العربية إذا كانت الستوريز بالعربي.\n` +
      `Stories:\n${ stories.map( ( s, i ) => `${ i + 1 }) ${ s.title }` ).join( '\n' ) }\n` +
      `أرجع فقط كود Mermaid بدون شرح.`;

    const r = await client.chat.completions.create( {
      model: "gpt-3.5-turbo",
      messages: [ { role: "user", content: prompt } ],
    } );

    const code = r.choices?.[ 0 ]?.message?.content || '';
    res.json( { code } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Failed to generate flowchart' } );
  }
} );

// ...existing code...

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`BRD backend listening on http://localhost:${PORT}`);
});