#!/usr/bin/env python3
"""Render report.md without modifying it. Run --check for preparation only.

Run the PDF skill's absolute mark_artifact_operation_started.mjs command exactly
once immediately before the first real render. This script never calls the marker.
Supported Markdown: headings, paragraphs, lists, blockquotes, pipe tables,
links, emphasis, inline code, numbered footnotes and simple Mermaid flowcharts.
Unsupported constructs raise errors rather than silently dropping content.
"""
from __future__ import annotations
import argparse
from collections import Counter, OrderedDict
import html
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import unicodedata

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, Flowable, PageBreak
from pypdf import PdfReader
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'output/pdf/Whop-Wringy-Research-Report.pdf'
TMP = ROOT / 'tmp/pdfs'
FONT_PATHS = {
    'CJK': os.environ.get('REPORT_FONT_REGULAR', '/System/Library/Fonts/STHeiti Light.ttc'),
    'CJKBold': os.environ.get('REPORT_FONT_BOLD', '/System/Library/Fonts/STHeiti Medium.ttc'),
    'Fallback': os.environ.get('REPORT_FONT_FALLBACK', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf'),
}
WIDTH = A4[0] - 104
COVERAGE = []
MISSING = set()


def fonts():
    for name, path in FONT_PATHS.items():
        pdfmetrics.registerFont(TTFont(name, path))
    pdfmetrics.registerFontFamily('CJK', normal='CJK', bold='CJKBold', italic='CJK', boldItalic='CJKBold')


def clean(s):
    return s.translate(str.maketrans({'\u2011':'-', '\u2012':'-', '\u2013':'-', '\u2014':'-', '\u2212':'-'}))


def escaped(s):
    """Preserve visible Unicode, with embedded fallback for unsupported glyphs."""
    s = clean(s)
    result = []
    run = ''
    previous = None
    for ch in s:
        regular = pdfmetrics.getFont('CJK').face.charToGlyph
        bold = pdfmetrics.getFont('CJKBold').face.charToGlyph
        fallback = pdfmetrics.getFont('Fallback').face.charToGlyph
        name = None if ord(ch) in regular and ord(ch) in bold else 'Fallback'
        if name and ord(ch) not in fallback and not ch.isspace():
            MISSING.add(ch)
        if name != previous and run:
            result.append(html.escape(run) if previous is None else '<font name="Fallback">'+html.escape(run)+'</font>')
            run = ''
        run += ch
        previous = name
    if run:
        result.append(html.escape(run) if previous is None else '<font name="Fallback">'+html.escape(run)+'</font>')
    return ''.join(result)


def definitions(source):
    lines = source.splitlines()
    body, refs = [], OrderedDict()
    i = 0
    while i < len(lines):
        match = re.match(r'^\[\^([^\]]+)\]:\s*(.*)$', lines[i])
        if not match:
            body.append(lines[i]); i += 1; continue
        ident, content = match.groups()
        if ident in refs:
            raise ValueError('Duplicate footnote definition: '+ident)
        i += 1
        while i < len(lines) and (lines[i].startswith('    ') or lines[i].startswith('\t')):
            content += ' ' + lines[i].strip(); i += 1
        refs[ident] = content
    body = '\n'.join(body)
    order = list(dict.fromkeys(re.findall(r'\[\^([^\]]+)\]', body)))
    unknown = set(order) - set(refs)
    if unknown:
        raise ValueError('Undefined footnotes: '+str(sorted(unknown)))
    order += [key for key in refs if key not in order]
    return body, refs, {key:i+1 for i,key in enumerate(order)}


class Inline:
    def __init__(self, numbers):
        self.numbers = numbers
        self.urls = set()

    def render(self, source, collect=True):
        if collect:
            plain = re.sub(r'\[\^([^\]]+)\]', '', source)
            plain = re.sub(r'\[([^\]]+)\]\(([^\s]+)(?:\s+"[^"]*")?\)', r'\1', plain)
            plain = re.sub(r'<(https?://[^>]+)>', r'\1', plain)
            plain = re.sub(r'[*`_~]', '', plain)
            plain = re.sub(r'<br\s*/?>', ' ', plain, flags=re.I)
            if plain.strip(): COVERAGE.append(clean(plain))
        # Balanced parentheses in Markdown links, e.g. Wikipedia URLs.
        pattern = re.compile(r'((?:\[\^[^\]]+\])+)|\[([^\]]+)\]\(((?:[^\s()]|\([^()]*\))+)(?:\s+"[^"]*")?\)|<(https?://[^>]+)>|(?:https?://[^\s<>]+)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*]+)\*|<br\s*/?>', re.I)
        result, end = [], 0
        for m in pattern.finditer(source):
            a,b,url,auto,strong,strong2,code,em = m.groups()
            segment=source[end:m.start()]
            if a:
                tail=segment[-2:]
                result.append(escaped(segment[:-2]))
                ids=re.findall(r'\[\^([^\]]+)\]',a)
                links=','.join(f'<link href="#ref-{self.numbers[k]}" color="#333333">{self.numbers[k]}</link>' for k in ids)
                result.append('<nobr>'+escaped(tail)+'<super>['+links+']</super></nobr>')
            else:
                result.append(escaped(segment))
            if a:
                pass
            elif b:
                self.urls.add(url)
                result.append('<link href="'+html.escape(url, quote=True)+'" color="#333333"><u>'+self.render(b,False)+'</u></link>')
            elif strong or strong2:
                result.append('<b>'+self.render(strong or strong2,False)+'</b>')
            elif code:
                result.append(escaped(code))
            elif em:
                result.append('<i>'+self.render(em,False)+'</i>')
            elif m.group().lower().startswith('<br'):
                result.append('<br/>')
            else:
                target = auto or m.group().rstrip('。，；,;')
                suffix = '' if auto else m.group()[len(target):]
                self.urls.add(target)
                result.append('<link href="'+html.escape(target, quote=True)+'" color="#333333"><u>'+escaped(target)+'</u></link>'+escaped(suffix))
            end = m.end()
        result.append(escaped(source[end:]))
        return ''.join(result)


def style(name, **kw):
    base = dict(fontName='CJK', fontSize=10.7, leading=17.8, textColor=colors.HexColor('#202020'),
                wordWrap='CJK', splitLongWords=True, spaceAfter=8, allowWidows=0, allowOrphans=0)
    base.update(kw)
    return ParagraphStyle(name, **base)


STYLES = {
    'body': style('body'),
    'title': style('title', fontName='CJKBold', fontSize=23, leading=31, spaceAfter=22, keepWithNext=True),
    'h2': style('h2', fontName='CJKBold', fontSize=16, leading=23, spaceBefore=19, spaceAfter=10, keepWithNext=True),
    'h3': style('h3', fontName='CJKBold', fontSize=12.6, leading=19, spaceBefore=13, spaceAfter=7, keepWithNext=True),
    'h4': style('h4', fontName='CJKBold', fontSize=11.2, leading=18, spaceBefore=10, spaceAfter=6, keepWithNext=True),
    'cell': style('cell', fontSize=9.3, leading=14.8, spaceAfter=0, allowWidows=1, allowOrphans=1),
    'th': style('th', fontName='CJKBold', fontSize=9.3, leading=14.8, spaceAfter=0, allowWidows=1, allowOrphans=1),
    'ref': style('ref', fontSize=9, leading=14.5, spaceAfter=8),
    'quote': style('quote', leftIndent=13, borderColor=colors.HexColor('#BBBBBB'), borderWidth=0.6, borderPadding=8, spaceBefore=5),
    'list': style('list', leftIndent=16, firstLineIndent=-12, spaceAfter=5),
}


class Diagram(Flowable):
    """Vector rendering of simple acyclic Mermaid flowcharts, without browser/network."""
    def __init__(self, code, inline):
        super().__init__()
        self.inline = inline
        self.nodes = OrderedDict()
        self.edges = []
        self.direction = 'TD'
        token = r'([\w-]+)(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})?'
        def node(text):
            m = re.fullmatch(token, text.strip())
            if not m: raise ValueError('Unsupported Mermaid node: '+text)
            key = m[1]; label = next((x for x in m.groups()[1:] if x is not None), None)
            if label is not None: self.nodes[key] = label.strip('"').replace('<br/>','\n').replace('<br>','\n')
            elif key not in self.nodes: self.nodes[key] = key
            return key
        for line in re.split(r'[;\n]', code):
            line = line.strip()
            if not line or line.startswith('%%'): continue
            m = re.fullmatch(r'(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)', line)
            if m: self.direction = m[1]; continue
            if '-->' in line:
                parts = re.split(r'\s*-->\s*',line)
                first = node(parts[0])
                for part in parts[1:]:
                    label = ''
                    if part.startswith('|'):
                        _,label,part = part.split('|',2)
                    nxt = node(part); self.edges.append((first,nxt,label)); first=nxt
            else: node(line)
        if not self.nodes: raise ValueError('Empty Mermaid flowchart')
        levels = {key:0 for key in self.nodes}
        for _ in range(len(self.nodes)):
            changed = False
            for a,b,_ in self.edges:
                if levels[b] <= levels[a]: levels[b] = levels[a]+1; changed=True
            if not changed: break
        if changed: raise ValueError('Mermaid requires an acyclic process diagram')
        self.layers = [[k for k in self.nodes if levels[k]==rank] for rank in range(max(levels.values())+1)]
        self.paras = {k:Paragraph(inline.render(v.replace('\n','<br/>')), STYLES['cell']) for k,v in self.nodes.items()}
        self.spaceBefore = 8; self.spaceAfter = 15

    def wrap(self, aw, ah):
        self.width = min(aw, WIDTH)
        # Use the declared orientation, provided readable labels fit.
        self.horizontal = self.direction in ('LR','RL') and len(self.layers)<=4
        self.pos = {}
        self.ranks = {k:i for i,layer in enumerate(self.layers) for k in layer}
        self.long_edges = [(a,b) for a,b,_ in self.edges if self.ranks[b]-self.ranks[a]>1]
        if self.horizontal:
            bw = (self.width-26*(len(self.layers)-1))/len(self.layers)
            heights = {k:max(45,p.wrap(bw-16,1000)[1]+20) for k,p in self.paras.items()}
            self.height = max(sum(heights[k]+18 for k in layer)-18 for layer in self.layers)
            for i,layer in enumerate(self.layers):
                x = i*(bw+26)
                y = self.height
                for k in layer:
                    h=heights[k]; y-=h; self.pos[k]=(x,y,bw,h); y-=18
        else:
            count=max(map(len,self.layers)); bw=(self.width-18*(count-1))/count
            hs=[max(max(45,self.paras[k].wrap(bw-16,1000)[1]+20) for k in layer) for layer in self.layers]
            self.height=sum(hs)+32*(len(hs)-1)
            y=self.height
            for layer,h in zip(self.layers,hs):
                y-=h; offset=(self.width-(len(layer)*bw+(len(layer)-1)*18))/2
                for i,k in enumerate(layer):self.pos[k]=(offset+i*(bw+18),y,bw,h)
                y-=32
        if self.horizontal and self.long_edges:
            margin=24+14*len(self.long_edges)
            self.pos={k:(x,y+margin,w,h) for k,(x,y,w,h) in self.pos.items()}
            self.height+=margin
        if self.height>A4[1]-125: raise ValueError('Diagram is too tall; split source into smaller diagrams')
        return self.width,self.height

    def draw(self):
        c=self.canv
        c.setStrokeColor(colors.HexColor('#777777')); c.setLineWidth(.65)
        for a,b,label in self.edges:
            x,y,w,h=self.pos[a]; xx,yy,ww,hh=self.pos[b]
            start=(x+w,y+h/2) if self.horizontal else (x+w/2,y)
            end=(xx,yy+hh/2) if self.horizontal else (xx+ww/2,yy+hh)
            if self.horizontal and (a,b) in self.long_edges:
                channel=12+14*self.long_edges.index((a,b))
                start=(x+w*.55,y); end=(xx+ww*.55,yy)
                c.line(*start,start[0],channel); c.line(start[0],channel,end[0],channel); c.line(end[0],channel,*end)
                start=(end[0],channel)
            else:
                c.line(*start,*end)
            theta=math.atan2(end[1]-start[1],end[0]-start[0])
            p=c.beginPath(); p.moveTo(*end)
            for angle in [theta+2.65,theta-2.65]:p.lineTo(end[0]+6*math.cos(angle),end[1]+6*math.sin(angle))
            p.close(); c.setFillColor(colors.HexColor('#777777')); c.drawPath(p,fill=1,stroke=0)
            if label:
                p=Paragraph(self.inline.render(label,False),STYLES['cell']); pw,ph=p.wrap(100,100)
                p.drawOn(c,(start[0]+end[0])/2+4,(start[1]+end[1])/2+3)
        for key,(x,y,w,h) in self.pos.items():
            c.setFillColor(colors.HexColor('#F5F5F5')); c.rect(x,y,w,h,fill=1,stroke=1)
            p=self.paras[key]; _,ph=p.wrap(w-16,h); p.drawOn(c,x+8,y+(h-ph)/2)


def cells(line):
    return [x.strip().replace('\\|','|') for x in re.split(r'(?<!\\)\|',line.strip().strip('|'))]


def make_story(body, refs, numbers):
    inline=Inline(numbers); story=[]; lines=body.splitlines(); i=0; title_seen=False
    while i<len(lines):
        line=lines[i].strip()
        if not line: i+=1; continue
        if line.startswith('```'):
            language=line[3:].strip(); code=[]; i+=1
            while i<len(lines) and not lines[i].strip().startswith('```'):code.append(lines[i]); i+=1
            if i==len(lines):raise ValueError('Unclosed fenced block')
            i+=1
            if language=='mermaid':story.append(Diagram('\n'.join(code),inline))
            else: raise ValueError('Only mermaid fences are supported; convert prose/code fence to ordinary report text')
            continue
        m=re.match(r'^(#{1,6})\s+(.+)$',line)
        if m:
            level=len(m[1]); content=m[2]
            if level==1:
                if title_seen:raise ValueError('Report must have exactly one title (#)')
                title_seen=True; kind='title'
            else:kind='h'+str(min(level,4))
            story.append(Paragraph(inline.render(content),STYLES[kind])); i+=1; continue
        if i+1<len(lines) and '|' in line and re.fullmatch(r'\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*',lines[i+1]):
            data=[cells(line)]; i+=2
            while i<len(lines) and '|' in lines[i] and lines[i].strip():data.append(cells(lines[i]));i+=1
            n=len(data[0])
            if any(len(row)!=n for row in data):raise ValueError('Unequal table column counts')
            weights=[]
            for col in range(n):
                lengths=sorted(len(row[col]) for row in data)
                weights.append(max(7,min(45, math.sqrt(sum(lengths)/len(lengths))*5)))
            widths=[WIDTH*w/sum(weights) for w in weights]
            table=LongTable([[Paragraph(inline.render(x),STYLES['th' if r==0 else 'cell']) for x in row] for r,row in enumerate(data)],colWidths=widths,repeatRows=1,splitByRow=1,splitInRow=60,hAlign='LEFT')
            table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#ECECEC')),('LINEBELOW',(0,0),(-1,0),.7,colors.HexColor('#888888')),('LINEBELOW',(0,1),(-1,-1),.35,colors.HexColor('#D6D6D6')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
            story.extend([table,Spacer(1,12)]);continue
        if re.fullmatch(r'[-*_]{3,}',line):story.append(Spacer(1,8));i+=1;continue
        if line in ('<!-- pagebreak -->','<pagebreak/>'):story.append(PageBreak());i+=1;continue
        if line.startswith('<!--'):raise ValueError('Remove editorial HTML comments before final render')
        kind='body'; prefix=''
        m=re.match(r'^(\s*)([-+*]|\d+[.)])\s+(.+)$',lines[i])
        if m:kind='list';prefix=('•' if m[2] in '-+*' else m[2])+' ';line=m[3]
        elif line.startswith('>'):kind='quote';line=re.sub(r'^>\s?','',line)
        para=[line];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^\s*(?:#{1,6}\s|```|>|[-+*]\s|\d+[.)]\s|<!--|\|)',lines[i]):
            if i+1<len(lines) and re.match(r'^\s*\|?\s*:?-{3,}',lines[i+1]):break
            para.append(lines[i].strip());i+=1
        story.append(Paragraph(escaped(prefix)+inline.render(' '.join(para)),STYLES[kind]))
    if not title_seen:raise ValueError('Report requires one Markdown # title')
    if refs:
        story.append(Paragraph('编号注释与来源',STYLES['h2']))
        for ident,num in sorted(numbers.items(),key=lambda item:item[1]):
            story.append(Paragraph(f'<a name="ref-{num}"/>{num}. '+inline.render(refs[ident]),STYLES['ref']))
    return story,inline


def footer(canvas,doc):
    canvas.saveState();canvas.setFont('CJK',8);canvas.setFillColor(colors.HexColor('#777777'))
    canvas.drawRightString(A4[0]-52,28,str(doc.page));canvas.restoreState()


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFKC',clean(s)) if c.isalnum())


def validate(pdf,inline):
    reader=PdfReader(pdf)
    pages=[p.extract_text() or '' for p in reader.pages]
    combined='\n'.join(pages); compact=norm(combined)
    snippets=[s for s in COVERAGE if norm(s)]
    absent=[s for s in snippets if norm(s) not in compact]
    # ReportLab can interleave table cells on extraction: word-order coverage is
    # diagnostic; character-count coverage additionally detects lost content.
    expected=Counter(''.join(c for s in snippets for c in clean(s) if '\u3400'<=c<='\u9fff'))
    actual=Counter(c for c in combined if '\u3400'<=c<='\u9fff')
    missing=dict(expected-actual)
    uris=[]; internal=0
    for page in reader.pages:
        for ref in page.get('/Annots',[]):
            obj=ref.get_object(); action=obj.get('/A',{})
            if action.get('/URI'):uris.append(str(action['/URI']))
            elif obj.get('/Dest') or action.get('/S')=='/GoTo':internal+=1
    fontcheck=subprocess.run(['pdffonts',str(pdf)],capture_output=True,text=True,check=True).stdout
    report=dict(page_count=len(pages),page_text_characters=[len(p) for p in pages],source_visible_blocks=len(snippets),
                exact_normalized_block_matches=len(snippets)-len(absent),unmatched_blocks=absent,
                unmatched_blocks_ignoring_citation_digits=[s for s in absent if re.sub(r'\d','',norm(s)) not in re.sub(r'\d','',compact)],
                missing_CJK_character_counts=missing,missing_glyphs=sorted(MISSING),
                external_hyperlink_annotations=len(uris),unique_external_urls=len(set(uris)),
                missing_external_urls=sorted(inline.urls-set(uris)),internal_hyperlinks=internal,
                embedded_font_check=fontcheck,blank_pages=[i+1 for i,p in enumerate(pages) if len(p.strip())<5])
    (TMP/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    (TMP/'extracted-text.txt').write_text(combined)
    print(json.dumps({k:v for k,v in report.items() if k not in ('unmatched_blocks','embedded_font_check')},ensure_ascii=False,indent=2))
    if missing or MISSING or report['missing_external_urls'] or report['blank_pages']:
        raise RuntimeError('PDF validation failed; inspect tmp/pdfs/validation.json')
    return len(pages)


def previews(pdf,count):
    folder=TMP/'pages';folder.mkdir(exist_ok=True)
    subprocess.run(['pdftoppm','-r','85','-png',str(pdf),str(folder/'page')],check=True,capture_output=True)
    files=sorted(folder.glob('page-*.png'))
    cols=4; tw=210; th=318
    for start in range(0,len(files),24):
        batch=files[start:start+24]; sheet=Image.new('RGB',(cols*tw,math.ceil(len(batch)/cols)*th),'#dddddd');draw=ImageDraw.Draw(sheet)
        for j,f in enumerate(batch):
            im=Image.open(f).convert('RGB');im.thumbnail((tw-12,th-26));x=(j%cols)*tw;y=(j//cols)*th
            sheet.paste(im,(x+(tw-im.width)//2,y+18));draw.text((x+8,y+3),str(start+j+1),fill='black')
        sheet.save(TMP/f'contact-sheet-{start//24+1}.png')
    print(f'Rendered {len(files)} page previews and contact sheets in {TMP}')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/'report.md')
    parser.add_argument('--check',action='store_true',help='Only inspect dependencies/fonts; never create PDF')
    parser.add_argument('--no-previews',action='store_true')
    args=parser.parse_args();fonts()
    if args.check:
        print(json.dumps({'fonts':FONT_PATHS,'font_glyph_counts':{name:len(pdfmetrics.getFont(name).face.charToGlyph) for name in FONT_PATHS},'tools':{x:shutil.which(x) for x in ['pdftoppm','pdffonts','pdfinfo']},'source':str(args.source),'source_exists':args.source.exists(),'output':str(OUT)},indent=2));return
    source=args.source.read_text(encoding='utf-8');body,refs,numbers=definitions(source)
    story,inline=make_story(body,refs,numbers)
    if MISSING:raise ValueError('Missing glyphs: '+''.join(sorted(MISSING)))
    TMP.mkdir(parents=True,exist_ok=True);OUT.parent.mkdir(parents=True,exist_ok=True)
    title=re.search(r'^#\s+(.+)',source,re.M)[1]
    doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=52,leftMargin=52,topMargin=47,bottomMargin=48,
                          title=title,author='',subject='',pageCompression=1)
    doc.build(story,onFirstPage=footer,onLaterPages=footer)
    count=validate(OUT,inline)
    (TMP/'footnote-map.json').write_text(json.dumps(numbers,ensure_ascii=False,indent=2))
    if not args.no_previews:previews(OUT,count)
    print('PDF: '+str(OUT))


if __name__=='__main__':main()
