/* ==========================================================================
   File: Backend.txt
   Note: Auto-organized comments & light formatting only — no logic changes.
   Generated: 2025-09-14 07:28:09
   ========================================================================== */

// -------------------- Imports --------------------
// ===== Helpers: التقاط JSON من ردّ الموديل ثم استخراج القصص =====
// ---------- App ----------
const ADO_API_VERSIONS = ['6.1-preview', '6.0'];
const app = express();
app.use( cors( { origin: 'http://localhost:3000' } ) );
app.use( bodyParser.json( { limit: '5mb' } ) );

// Middlewares (بعد إنشاء app مباشرة)
app.use( cors( {
  origin: 'http://localhost:3000',
  credentials: true,
  methods: [ 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS' ],
  allowedHeaders: [ 'Content-Type', 'x-api-key', 'x-model', 'x-lang' , 'x-ado-org','x-ado-pat','x-ado-project', 'x-ado-base'],
} ) );
app.options( '*', cors() );

app.use( express.json( { limit: '10mb' } ) );      // بدل bodyParser.json
app.use( express.urlencoded( { extended: true } ) ); // لو محتاج x-www-form-urlencoded

// Health (قبل باقي الروتات اختياريًا)
app.get( '/openai/health', ( _req, res ) => res.json( { ok: true, status: 'ok' } ) );

function extractJson( raw ) {
  if( !raw ) return null;
  const m = raw.match( /```json([\s\S]*?)```/i ) || raw.match( /```([\s\S]*?)```/ );
  const candidate = ( m ? m[ 1 ] : raw ).trim();
  const objStart = candidate.indexOf( '{' );
  const objEnd = candidate.lastIndexOf( '}' );
  const arrStart = candidate.indexOf( '[' );
  const arrEnd = candidate.lastIndexOf( ']' );

  let jsonText = candidate;
  if( objStart !== -1 && objEnd !== -1 && objEnd > objStart ) {
    jsonText = candidate.slice( objStart, objEnd + 1 );
  } else if( arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart ) {
    jsonText = candidate.slice( arrStart, arrEnd + 1 );
  }
  try { return JSON.parse( jsonText ); } catch { return null; }
}

function safeParseStories( raw ) {
  const data = extractJson( raw );
  if( !data ) return [];
  if( Array.isArray( data ) ) return data;                 // مصفوفة مباشرة
  if( Array.isArray( data.stories ) ) return data.stories; // كائن فيه stories
  return [];
}
// ===== Helper: encode/decode acceptance_criteria (JSON in DB) =====
function encodeAC( ac ) {
  return JSON.stringify( Array.isArray( ac ) ? ac : ( ac ? [ String( ac ) ] : [] ) );
}
function decodeAC( text ) {
  if( !text ) return [];
  try {
    const v = JSON.parse( text );
    return Array.isArray( v ) ? v : [];
  } catch {
    // دعم قديم لو كانت محفوظة كسطور نص
    return String( text ).split( /\r?\n/ ).map( s => s.trim() ).filter( Boolean );
  }
}

// ===== Helper: استخراج نص من ملف مرفوع بحسب المايم تايب =====
// ملاحظة: استبدل db/getUploadById حسب تخزينك الفعلي (قاعدة بيانات / نظام ملفات)
async function extractTextFromUpload( upload ) {
  const { mimetype, buffer, path } = upload; // وفّر واحد منهم على الأقل
  const fileBuffer = buffer || ( await fs.promises.readFile( path ) );

  if( mimetype === 'application/pdf' ) {
    const data = await pdf( fileBuffer );
    const text = ( data.text || '' ).trim();
    if( !text ) {
      throw Object.assign( new Error( 'PDF بلا نص (غالبًا ممسوح ضوئيًا).' ), { status: 422 } );
    }
    return text;
  }

  if( mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ) {
    const result = await mammoth.extractRawText( { buffer: fileBuffer } );
    const text = ( result.value || '' ).trim();
    if( !text ) throw Object.assign( new Error( 'DOCX بدون نص مستخرج.' ), { status: 422 } );
    return text;
  }

  if( mimetype === 'application/msword' ) {
    throw Object.assign( new Error( 'صيغة DOC القديمة غير مدعومة — ارفع DOCX أو PDF نصّي.' ), { status: 415 } );
  }

  // TXT/MD …الخ
  return fileBuffer.toString( 'utf-8' ).trim();
}

// ===== Helper: جلب المرفق من التخزين عبر ID =====
// غيّرها بما يناسبك (SQLite/Prisma/GridFS/مسار على القرص)
async function getUploadById( uploadId ) {
  // مثال SQLite تخيّلي:
  // const row = await db.get('SELECT mimetype, content, path FROM uploads WHERE id = ?', [uploadId]);
  // return { mimetype: row.mimetype, buffer: row.content, path: row.path };

  // Placeholder: ارجع null لو مش مطبق DB
  return null;
}

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
// ------------------ End Imports ------------------

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
// Component
function getKeyFromReq( req ) {
  const hdr = req.headers[ 'x-api-key' ];
  return ( typeof hdr === 'string' && hdr.trim() ) ? hdr.trim() : process.env.OPENAI_API_KEY;
}
// Component
function getModelFromReq( req ) {
  const hdr = req.headers[ 'x-model' ];
  return ( typeof hdr === 'string' && hdr.trim() ) ? hdr.trim() : 'gpt-4.1-mini';
}
// Component
function getLangFromReq( req ) {
  const hdr = req.headers[ 'x-lang' ];
  if( hdr === 'ar' || hdr === 'en' ) return hdr;
  return 'auto';
}
// Component
function langLabel( lang ) {
  if( lang === 'en' ) return 'English';
  return 'Arabic';
}
// Component
function getClient( req, res ) {
  const key = getKeyFromReq( req );
  if( !key ) {
    res.status( 500 ).json( { error: 'No OpenAI API key (env or x-api-key)' } );
    return null;
  }
  return new OpenAI( { apiKey: key } );
}

// ---------- App ----------

// CORS + JSON
app.use( cors( {
  origin: 'http://localhost:3000',
  credentials: true,
  methods: [ 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS' ],
  allowedHeaders: [ 'Content-Type', 'x-api-key', 'x-model', 'x-lang' ],
} ) );
app.options( '*', cors() );

app.use( express.json( { limit: '10mb' } ) ); // لقراءة JSON body

// -------------------- App Setup --------------------


// uploads
const upload = multer( { storage: multer.memoryStorage() } );

app.delete( '/stories/:id', async ( req, res ) => {
  try {
    const { id } = req.params;
    if( !id ) return res.status( 400 ).json( { error: 'Story id is required' } );

    await db.run( `DELETE FROM user_stories WHERE id = ?`, [ id ] );

    res.json( { ok: true } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Delete failed' } );
  }
} );
// Route
app.get( '/openai/health', ( _req, res ) => {
  return res.json( { ok: true, status: 'ok' } );
} );

app.get( '/', ( _req, res ) => res.json( { ok: true, service: 'BRD backend' } ) );

// ---------- Upload BRD ----------
// توليد قصص المستخدم من نفس الملف المرفوع
app.post( '/stories/generate/from-upload', async ( req, res ) => {
  try {
    // عامل uploadId = brdId مؤقتًا
    const { uploadId, brdId } = req.body || {};
    const id = brdId ?? uploadId;

    if( !id ) return res.status( 400 ).json( { error: 'أرسل brdId أو uploadId.' } );

    // أعد استخدام منطق /stories/generate عن طريق استدعاء داخلي
    req.body = { brdId: id };
    return app._router.handle( req, res, () => {}, 'POST', '/stories/generate' );
  } catch( err ) {
    console.error( err );
    return res.status( 500 ).json( { error: 'خطأ غير متوقع.' } );
  }
} );

// ===== API version fallback helpers =====
const addApi = (path, v) => `${path}${path.includes('?') ? '&' : '?'}api-version=${v}`;

// جرّب 6.1-preview ثم 6.0 تلقائيًا
async function adoFetchWithApi(base, path, opts) {
  let lastErr;
  for (const v of ADO_API_VERSIONS) {
    try {
      return await adoFetch(`${base}${addApi(path, v)}`, opts);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// Route
app.post( '/upload', upload.single( 'file' ), async ( req, res ) => {
  try {
    const file = req.file;
    if( !file ) return res.status( 400 ).json( { error: 'No file uploaded' } );

    let text = '';
    if( file.mimetype === 'application/pdf' ) {
      const data = await pdf( file.buffer );
      text = ( data.text || '' ).trim();
      if( !text ) return res.status( 422 ).json( { error: 'PDF بلا نص (غالبًا ممسوح ضوئيًا).' } );
    } else if( file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ) {
      const result = await mammoth.extractRawText( { buffer: file.buffer } );
      text = ( result.value || '' ).trim();
    } else if( file.mimetype === 'application/msword' ) {
      return res.status( 415 ).json( { error: 'صيغة DOC غير مدعومة. استخدم DOCX أو PDF نصّي.' } );
    } else {
      text = file.buffer.toString( 'utf-8' ).trim();
    }

    const result = await db.run(
      'INSERT INTO brd_versions (version, content) VALUES (?, ?)',
      [ 'v' + Date.now(), text ]
    );
    const brdId = result.lastID;

    res.json( {
      success: true,
      message: 'BRD uploaded and stored!',
      brdId,                // <-- هنرجّع الـ brdId
      name: file.originalname || 'brd'
    } );
  } catch( err ) {
    console.error( 'Upload error:', err );
    res.status( 500 ).json( { error: 'Failed to upload BRD' } );
  }
} ); // <--- اقفال الراوت



// ---------- Chat (SSE) ----------
// Route
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
      `"""${ brd?.slice( 0, 100000 ) || 'NO_BRD_UPLOADED' }"""\n` +
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
// Route
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
        { role: 'user', content: brd.slice( 0, 100000 ) },
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
function normalizeStory( s ) {
  const title = ( s.title || s.Title || s.name || "" ).toString().trim();
  const description = ( s.description || s.desc || "" ).toString().trim();
  let ac = s.acceptance_criteria ?? s[ "acceptance criteria" ] ?? s.ac ?? [];
  if( typeof ac === "string" ) {
    ac = ac.split( /\r?\n|•|-|–|—/g ).map( t => t.trim() ).filter( Boolean );
  }
  if( !Array.isArray( ac ) ) ac = [];
  return { title, description, acceptance_criteria: ac };
}

function parseStoriesLoose( raw ) {
  const out = [];
  const text = ( raw || "" ).trim();
  const parts = text
    .split( /(?:^|\n)\s*(?:قصة\s+مستخدم|User\s*Story)\s*\d*\s*[:：-]?\s*/i )
    .map( p => p.trim() ).filter( Boolean );
  if( !parts.length ) return text ? [ { title: text.slice( 0, 80 ), description: text } ] : [];
  for( const p of parts ) {
    const lines = p.split( /\r?\n/ ).map( l => l.trim() ).filter( Boolean );
    const firstLine = lines[ 0 ] || "";
    const title = firstLine.replace( /^\s*[:\-–—]\s*/, "" ).slice( 0, 120 ).trim() || "Story";
    const ac = lines.filter( l => /^[\-\–\—•\*]|^AC[:：]/i.test( l ) )
      .map( l => l.replace( /^AC[:：]\s*/i, "" ).replace( /^[\-\–\—•\*]\s*/, "" ).trim() );
    const body = lines
      .filter( l => l !== firstLine && !/^[\-\–\—•\*]|^AC[:：]/i.test( l ) )
      .join( "\n" );
    out.push( { title, description: body, acceptance_criteria: ac } );
  }
  return out;
}
app.post( '/stories/generate', async ( req, res ) => {
  try {
    const { text: bodyText, brdText: bodyBrdText, brdId } = req.body || {};
    let brdText = ( bodyText || bodyBrdText || '' ).trim();

    if( !brdText && brdId ) {
      const row = await db.get( 'SELECT content FROM brd_versions WHERE id = ?', [ brdId ] );
      brdText = ( row?.content || '' ).trim();
    }
    if( !brdText ) {
      return res.status( 400 ).json( { error: 'لا يوجد نص BRD لإنتاج قصص المستخدم.' } );
    }

    const client = getClient( req, res );
    const model = getModelFromReq( req );

    const systemPrompt = `
أنت مساعد يحوّل BRD إلى User Stories. أرجع JSON فقط بهذا الشكل:
{
  "stories": [
    {
      "title": "string",
      "description": "string",
      "acceptance_criteria": ["criterion 1", "criterion 2"]
    }
  ]
}
لا تُرجِع أي نص قبل/بعد JSON. لو بالعربي، خلّي القيم عربية لكن أسماء الحقول كما هي.
`.trim();

    const userPrompt = `حوّل النص التالي إلى قصص مستخدم بمعايير قبول نقطية واضحة:\n---\n${ brdText }\n---`;

    const r = await client.chat.completions.create( {
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    } );

    const raw = r.choices?.[ 0 ]?.message?.content || '';

    // حاول JSON
    let stories = [];
    try {
      const parsed = JSON.parse( raw );
      if( parsed && Array.isArray( parsed.stories ) ) {
        stories = parsed.stories.map( normalizeStory );
      }
    } catch( _ ) { /* fallback below */ }

    if( !stories.length ) {
      return res.status( 422 ).json( {
        error: 'تعذّر تحليل رد الموديل إلى قصص مستخدم.',
        debug: raw.slice( 0, 800 ),
      } );
    }
    if( String( req.query.save ) === 'true' ) {
      const bid = ( await latestBrdRow() )?.id ?? null;
      const stmt2 = await db.prepare( `
    INSERT INTO user_stories (brd_id, title, description, acceptance_criteria)
    VALUES (?, ?, ?, ?)
  `);
      try {
        for( const s of stories ) {
          await stmt2.run( bid, s.title, s.description, encodeAC( s.acceptance_criteria ) );
        }
      } finally {
        await stmt2.finalize();
      }
    }
    return res.json( { count: stories.length, stories } );
  } catch( e ) {
    console.error( e );
    return res.status( 500 ).json( { error: 'حدث خطأ أثناء توليد قصص المستخدم.' } );
  }

} );



// ---------- Stories (GET) ----------
// Route
// ---------- Stories (GET) ----------
app.get( '/stories', async ( _req, res ) => {
  try {
    const rows = await db.all( `
      SELECT id, title, description, acceptance_criteria
      FROM user_stories
      ORDER BY id ASC
    `);
    const stories = rows.map( r => ( {
      id: r.id,
      title: r.title || '',
      description: r.description || '',
      acceptance_criteria: decodeAC( r.acceptance_criteria ),
    } ) );
    res.json( { stories } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { stories: [] } );
  }
} );

// ---------- Update Story ----------
// Route
app.put( '/stories/:id', async ( req, res ) => {
  try {
    const { id } = req.params;
    const { title, description, acceptance_criteria } = req.body || {};

    if( !id ) return res.status( 400 ).json( { error: 'Story id is required' } );

    await db.run(
      `UPDATE user_stories
       SET title = ?, description = ?, acceptance_criteria = ?
       WHERE id = ?`,
      [
        title?.trim() || '',
        description?.trim() || '',
        JSON.stringify( acceptance_criteria || [] ),
        id
      ]
    );

    res.json( { ok: true } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'Update failed' } );
  }
} );

// ---------- Stories (BULK SAVE) ----------
app.post( '/stories/bulk', async ( req, res ) => {
  try {
    const { stories, brdId } = req.body ?? {};
    if( !Array.isArray( stories ) || stories.length === 0 ) {
      return res.status( 400 ).json( { error: 'stories array required' } );
    }
    const bid = brdId ?? ( await latestBrdRow() )?.id ?? null;

    const stmt = await db.prepare( `
      INSERT INTO user_stories (brd_id, title, description, acceptance_criteria)
      VALUES (?, ?, ?, ?)
    `);
    try {
      for( const s of stories ) {
        const title = ( s.title ?? '' ).toString().trim();
        const description = ( s.description ?? '' ).toString().trim();
        const ac = encodeAC( s.acceptance_criteria );
        await stmt.run( bid, title, description, ac );
      }
    } finally {
      await stmt.finalize();
    }

    res.json( { ok: true, inserted: stories.length } );
  } catch( e ) {
    console.error( e );
    res.status( 500 ).json( { error: 'bulk save failed' } );
  }
} );

// ---------- Insights ----------
// Route
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
        { role: 'user', content: brd.slice( 0, 100000 ) },
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
// Route
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
// Route
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
        { role: 'user', content: `BRD:\n"""${ brd.slice( 0, 100000 ) }"""` },
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
// Route
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
        { role: 'user', content: `BRD:\n"""${ brd.slice( 0, 100000 ) }"""` },
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
// Route
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
// Component
function htmlEscape( s = '' ) {
  return s
    .replace( /&/g, '&amp;' ).replace( /</g, '&lt;' )
    .replace( />/g, '&gt;' ).replace( /"/g, '&quot;' )
    .replace( /'/g, '&#39;' );
}

// Route
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
// Route
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
// ---------------- Server Start ----------------
app.listen( PORT, () => {
  console.log( `BRD backend listening on http://localhost:${ PORT }` );
} );
/* ---------------- Azure DevOps (ADO) Integration --------------- */
/** كل النداءات بتقرأ org/pat/project من الهيدرز:
 *  x-ado-org, x-ado-pat, x-ado-project
 */
// =============== ADO Integration (fixed) ===============

// ------- helpers -------
const ADO = {
  baseUrl: (baseOrOrg) => {
    if (!baseOrOrg) return '';
    if (/^https?:\/\//i.test(baseOrOrg)) return String(baseOrOrg).replace(/\/+$/,'');
    return `https://dev.azure.com/${baseOrOrg}`;
  },
  auth:  (pat) => ({ Authorization: 'Basic ' + Buffer.from(':' + pat).toString('base64') }),
  json:  { 'Content-Type': 'application/json' },
  patch: { 'Content-Type': 'application/json-patch+json' },
};

function resolveBase(req) {
  const baseHdr = String(req.header('x-ado-base') || req.header('x-ado-org') || '').trim();
  const coll    = String(req.header('x-ado-collection') || '').trim().replace(/^\/+|\/+$/g,'');
  if (!baseHdr) return '';
  let base = ADO.baseUrl(baseHdr);     // https://azure.2p.com.sa أو https://dev.azure.com/<org>
  if (coll) base = `${base}/${coll}`;  // …/Projects أو …/DefaultCollection
  return base.replace(/\/+$/,'');
}

async function adoFetch(url, { pat, method='GET', headers={}, body } = {}) {
  const r = await fetch(url, { method, headers: { ...headers, ...ADO.auth(pat) }, body });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch {}
  if (!r.ok) throw Object.assign(new Error(json?.message || text || `HTTP ${r.status}`), { status: r.status, json, urlTried: url });
  return json ?? {};
}


// WIQL + جلب العناصر
 async function wiql({ base, project, pat, query, expand = 'Relations' }) {
   const proj = encodeURIComponent(project);
   const data = await adoFetchWithApi(
     base,
     `/${proj}/_apis/wit/wiql`,
     { pat, method: 'POST', headers: ADO.json, body: JSON.stringify({ query }) }
   );
   const ids = (data.workItems || []).map(w => w.id);
   if (!ids.length) return [];
   const items = await adoFetchWithApi(
     base,
     `/_apis/wit/workitems?ids=${ids.join(',')}&$expand=${encodeURIComponent(expand)}`,
     { pat }
   );
   return items.value || [];
 }

// إنشاء Work Item
async function createWorkItem({ base, project, pat, type, patch }) {
   const proj = encodeURIComponent(project);
   return adoFetchWithApi(
     base,
     `/${proj}/_apis/wit/workitems/$${encodeURIComponent(type)}`,
     { pat, method: 'POST', headers: ADO.patch, body: JSON.stringify(patch) }
   );
 }

/* --------- 1) المشاريع --------- */
app.get('/ado/projects', async (req, res) => {
  try {
    const pat  = String(req.header('x-ado-pat') || '');
    const base = resolveBase(req);
    
    if (!pat || !base) return res.status(400).json({ error: 'base + pat required' });

    const data = await adoFetchWithApi(base, '/_apis/projects', { pat });
    res.json((data.value || []).map(p => ({ id: p.id, name: p.name })));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'projects failed' });
  }
});

/* --------- 2) عرض Epics --------- */
app.get('/ado/epics', async (req, res) => {
  try {
    const pat     = String(req.header('x-ado-pat') || '');
    const project = String(req.header('x-ado-project') || '');
    const base    = resolveBase(req);
    if (!pat || !base || !project) return res.status(400).json({ error: 'base/pat/project required' });

    const items = await wiql({
      base, project, pat,
      query:
        `SELECT [System.Id] FROM WorkItems ` +
        `WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] = 'Epic' ` +
        `ORDER BY [System.ChangedDate] DESC`,
    });

    res.json(items.map((w) => ({ id: w.id, title: w.fields?.['System.Title'] })));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'epics failed' });
  }
});

/* --------- 3) إنشاء Epic --------- */
app.post('/ado/epics', async (req, res) => {
  try {
    const pat     = String(req.header('x-ado-pat') || '');
    const project = String(req.header('x-ado-project') || '');
    const base    = resolveBase(req);
    const { title, description, tags } = req.body || {};
    if (!pat || !base || !project || !title) return res.status(400).json({ error: 'missing fields' });

    const patch = [
      { op: 'add', path: '/fields/System.Title', value: title },
      description ? { op: 'add', path: '/fields/System.Description', value: description } : null,
      tags?.length ? { op: 'add', path: '/fields/System.Tags', value: tags.join('; ') } : null,
    ].filter(Boolean);

    const w = await createWorkItem({ base, project, pat, type: 'Epic', patch });
    res.json({ id: w.id, title: w.fields?.['System.Title'] });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'create epic failed' });
  }
});

/* --------- 4) عرض Features (اختياريًا مفلترة بالـ Epic) --------- */
app.get('/ado/features', async (req, res) => {
  try {
    const pat     = String(req.header('x-ado-pat') || '');
    const project = String(req.header('x-ado-project') || '');
    const base    = resolveBase(req);
    const epicId  = Number(req.query.epicId || 0);
    if (!pat || !base || !project) return res.status(400).json({ error: 'base/pat/project required' });

    const items = await wiql({
      base, project, pat,
      query:
        `SELECT [System.Id] FROM WorkItems ` +
        `WHERE [System.TeamProject] = '${project}' AND [System.WorkItemType] = 'Feature' ` +
        `ORDER BY [System.ChangedDate] DESC`,
    });

    let list = items.map((w) => ({
      id: w.id,
      title: w.fields?.['System.Title'],
      parentUrl: (w.relations || []).find((r) => r.rel === 'System.LinkTypes.Hierarchy-Reverse')?.url || null,
    }));

    if (epicId) {
      const epicUrl = `${base}/_apis/wit/workItems/${epicId}`;
      list = list.filter((f) => f.parentUrl && f.parentUrl.includes(epicUrl));
    }
    res.json(list);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'features failed' });
  }
});

/* --------- 5) إنشاء Feature (مع ربط Parent = Epic) --------- */
app.post('/ado/features', async (req, res) => {
  try {
    const pat     = String(req.header('x-ado-pat') || '');
    const project = String(req.header('x-ado-project') || '');
    const base    = resolveBase(req);
    const { title, description, epicId, tags } = req.body || {};
    if (!pat || !base || !project || !title) return res.status(400).json({ error: 'missing fields' });

    const patch = [
      { op: 'add', path: '/fields/System.Title', value: title },
      description ? { op: 'add', path: '/fields/System.Description', value: description } : null,
      tags?.length ? { op: 'add', path: '/fields/System.Tags', value: tags.join('; ') } : null,
      epicId ? {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${base}/_apis/wit/workItems/${epicId}`,
          attributes: { name: 'Parent' },
        },
      } : null,
    ].filter(Boolean);

    const w = await createWorkItem({ base, project, pat, type: 'Feature', patch });
    res.json({ id: w.id, title: w.fields?.['System.Title'] });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'create feature failed' });
  }
});

/* --------- 6) Bulk: إنشاء User Stories تحت Feature --------- */
app.post('/ado/stories/bulk', async (req, res) => {
  try {
    const pat      = String(req.header('x-ado-pat') || '');
    const project  = String(req.header('x-ado-project') || '');
    const base     = resolveBase(req);
    const { featureId, stories } = req.body || {};
    if (!pat || !base || !project || !featureId) return res.status(400).json({ error: 'missing fields' });
    if (!Array.isArray(stories) || !stories.length) return res.status(400).json({ error: 'stories required' });

    const results = [];
    for (const s of stories) {
      const htmlDesc =
        `<p>${String(s.description || '').replace(/\n/g, '<br/>')}</p>` +
        (Array.isArray(s.acceptance_criteria) && s.acceptance_criteria.length
          ? `<p><strong>Acceptance Criteria</strong></p><ul>${
              s.acceptance_criteria.map((x) => `<li>${x}</li>`).join('')
            }</ul>`
          : '');

      const patch = [
        { op: 'add', path: '/fields/System.Title',       value: String(s.title || '').slice(0, 250) },
        { op: 'add', path: '/fields/System.Description', value: htmlDesc },
        { op: 'add', path: '/relations/-', value: {
            rel: 'System.LinkTypes.Hierarchy-Reverse',
            url: `${base}/_apis/wit/workItems/${featureId}`,
            attributes: { name: 'Parent' },
        }},
        s.tags?.length ? { op: 'add', path: '/fields/System.Tags', value: s.tags.join('; ') } : null,
      ].filter(Boolean);

      let wi;
      try {
        wi = await createWorkItem({ base, project, pat, type: 'User Story',            patch });
      } catch {
        wi = await createWorkItem({ base, project, pat, type: 'Product Backlog Item',  patch });
      }

      results.push({
        id: wi.id,
        title: wi.fields?.['System.Title'],
        url: `${base}/${encodeURIComponent(project)}/_workitems/edit/${wi.id}`,
      });
    }

    res.json({ ok: true, created: results });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'push stories failed' });
  }
});

// =============== End ADO Integration (fixed) ===============
