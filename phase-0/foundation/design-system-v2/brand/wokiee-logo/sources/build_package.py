#!/usr/bin/env python3
"""Rebuild faithful Wokiee production assets. Requires Pillow, potrace, rsvg-convert."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import argparse, subprocess, hashlib, json, shutil, tempfile, copy, xml.etree.ElementTree as ET, zipfile
P=Path(__file__).resolve().parents[1]
SRC=P/'sources'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preview-font', type=Path, help='Optional font for contact-sheet labels only; never used for logo artwork.')
args=parser.parse_args()
NS='http://www.w3.org/2000/svg'
ET.register_namespace('',NS)
def tag(s): return '{'+NS+'}'+s
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args): subprocess.run(list(map(str,args)),check=True)
def svg(w,h,groups,color='black'):
    root=ET.Element(tag('svg'),{'width':str(w),'height':str(h),'viewBox':f'0 0 {w} {h}','role':'img','aria-label':'Wokiee logo'})
    for group in groups:
        g=copy.deepcopy(group)
        for x in g.iter():
            if 'fill' in x.attrib: x.set('fill',color)
        root.append(g)
    return root

def save_svg(root,p):
    p.parent.mkdir(parents=True,exist_ok=True)
    ET.ElementTree(root).write(p,encoding='utf-8',xml_declaration=True)
def placed(g,transform):
    p=ET.Element(tag('g'),{'transform':transform});p.append(copy.deepcopy(g));return p

def render(src,dst,width=None,fmt='png'):
    dst.parent.mkdir(parents=True,exist_ok=True)
    args=['rsvg-convert','-f',fmt,'-o',dst]
    if width:args+=['-w',str(width)]
    run(*args,src)

symbol_ref=SRC/'13-symbol-smooth.png';word_ref=SRC/'15-approved-wordmark-A-reference.png'
# The canonical package contains both immutable references; never pull sibling artwork.
for p in [symbol_ref,word_ref]:
    if not p.is_file():raise FileNotFoundError(f'Missing packaged source: {p.name}')
expected={'13-symbol-smooth.png':'6c7cd303eb109cceab39881d6fdefde3bae022c5951b13588bf27a5747b0a88e','15-approved-wordmark-A-reference.png':'70dd163821d5bb2610e1969f000c0500ea025920333469c8d23caf6ca1eb2a5f'}
assert all(sha(SRC/k)==v for k,v in expected.items())
symbol=Image.open(symbol_ref).convert('L').crop((69,79,1075,1262))
symbol=ImageChops.invert(symbol)
word_rgb=Image.open(word_ref).convert('RGB');word=Image.new('L',word_rgb.size)
for y in range(word.height):
    for x in range(word.width):
        lum=sum(word_rgb.getpixel((x,y)))/3
        bg=240.5 if ((x-16)//36+(y-8)//36)%2==0 else 255
        word.putpixel((x,y),round(255*max(0,(bg-lum)/bg)) if lum<238 else 0)
word=word.crop((0,17,529,139))
groups={};metrics={}
with tempfile.TemporaryDirectory() as td:
    tmp=Path(td)
    for name,mask in [('symbol',symbol),('wordmark',word)]:
        mask.save(SRC/(name+'-extracted-alpha.png'))
        # Supersampling gives Potrace subpixel coordinates; no dilation, erosion or manual edits.
        up=mask.resize((mask.width*4,mask.height*4),Image.Resampling.LANCZOS)
        binary=up.point(lambda a:0 if a>=128 else 255).convert('1')
        binary.save(tmp/(name+'.pbm'))
        run('potrace',tmp/(name+'.pbm'),'-s','-t','0','-O','0.2','-u','100','-o',tmp/(name+'.svg'))
        traced=ET.parse(tmp/(name+'.svg')).getroot().find(tag('g'))
        groups[name]=placed(traced,'scale(0.25)')
        master=SRC/(name+'-trace-master.svg');save_svg(svg(mask.width,mask.height,[groups[name]]),master)
        render(master,tmp/(name+'.png'))
        raster=Image.open(tmp/(name+'.png')).convert('RGBA').getchannel('A')
        a=[v>=128 for v in mask.getdata()];b=[v>=128 for v in raster.getdata()]
        intersection=sum(x and y for x,y in zip(a,b));union=sum(x or y for x,y in zip(a,b));diff=sum(x!=y for x,y in zip(a,b))
        metrics[name]={'reference_size':list(mask.size),'silhouette_iou':intersection/union,'symmetric_difference_pixels':diff,'symmetric_difference_fraction_of_union':diff/union,'mean_absolute_alpha_error_0_to_255':sum(abs(x-y) for x,y in zip(mask.getdata(),raster.getdata()))/(mask.width*mask.height)}
        assert intersection/union>.99
    # The approved proof uses integer rounded raster widths. These explicit values preserve its geometry.
    lockup=[placed(groups['symbol'],'scale(0.27435387673956263 0.2738799661876585)'),placed(groups['wordmark'],'translate(362 84) scale(1.9678638941398865 1.9672131147540983)')]
    # Matrices above map 1006×1183→276×324 and 529×122→1041×240, exactly as approved.
    forms={'horizontal':(1403,324,lockup),'symbol':(1006,1183,[groups['symbol']]),'wordmark':(529,122,[groups['wordmark']])}
    for color in ['black','white']:
        for name,(w,h,gs) in forms.items():
            file=P/'svg'/f'wokiee-{name}-{color}.svg';save_svg(svg(w,h,gs,color),file)
            if name!='symbol':
                for width in [320,640,1280,2560]:render(file,P/'png'/color/f'wokiee-{name}-{color}-{width}w.png',width)
            else:
                # Square icons retain all artwork, with 10% vertical padding on each edge.
                square=svg(1478.75,1478.75,[placed(groups['symbol'],'translate(236.375 147.875)')],color)
                square_file=P/'svg'/f'wokiee-symbol-square-{color}.svg';save_svg(square,square_file)
                for size in [32,64,128,256,512,1024]:render(square_file,P/'png'/color/f'wokiee-symbol-{color}-{size}.png',size)
            if color=='black':render(file,P/'pdf'/f'wokiee-{name}-black.pdf',fmt='pdf')
    # Favicon uses the same padded symbol; no alternate drawing or small-size substitution.
    (P/'icons').mkdir(exist_ok=True)
    shutil.copy2(P/'svg/wokiee-symbol-square-black.svg',P/'icons/favicon.svg')
    for size in [16,32,48]:render(P/'icons/favicon.svg',tmp/f'favicon-{size}.png',size)
    Image.open(tmp/'favicon-48.png').save(P/'icons/favicon.ico',format='ICO',sizes=[(16,16),(32,32),(48,48)],append_images=[Image.open(tmp/'favicon-16.png'),Image.open(tmp/'favicon-32.png')])
    for name,size in [('apple-touch-icon',180),('android-chrome-192',192),('android-chrome-512',512),('social-avatar',1024)]:
        render(P/'icons/favicon.svg',tmp/'icon.png',size)
        icon=Image.open(tmp/'icon.png').convert('RGBA');bg=Image.new('RGB',(size,size),'white');bg.paste(icon,mask=icon.getchannel('A'));bg.save(P/'icons'/f'{name}.png')
    # Presentation-only contact sheet; not new artwork.
    board=Image.new('RGB',(1800,1200),'white');d=ImageDraw.Draw(board)
    preview_font=args.preview_font or Path('/System/Library/Fonts/Helvetica.ttc')
    font=ImageFont.truetype(str(preview_font),25) if preview_font.is_file() else ImageFont.load_default(size=25)
    for row,(color,bg,fg) in enumerate([('black','#ffffff','#333333'),('white','#171717','#eeeeee')]):
        y=row*600;d.rectangle((0,y,1800,y+600),fill=bg)
        d.text((70,y+40),'WOKIEE / APPROVED LOGO / '+color.upper(),font=font,fill=fg)
        render(P/'svg'/f'wokiee-horizontal-{color}.svg',tmp/'preview.png',1180)
        im=Image.open(tmp/'preview.png').convert('RGBA');board.paste(im,(70,y+175),im)
        render(P/'svg'/f'wokiee-symbol-square-{color}.svg',tmp/'preview-symbol.png',350)
        im=Image.open(tmp/'preview-symbol.png').convert('RGBA');board.paste(im,(1370,y+125),im)
        render(P/'svg'/f'wokiee-horizontal-{color}.svg',tmp/'header.png',275)
        im=Image.open(tmp/'header.png').convert('RGBA');board.paste(im,(70,y+465),im)
        d.text((375,y+479),'1× header / 275 px wide',font=font,fill=fg)
        d.text((70,y+555),'Horizontal lockup',font=font,fill=fg);d.text((1410,y+535),'Symbol',font=font,fill=fg)
    board.save(P/'CONTACT-SHEET.png')

validation={'all_svg_are_paths_only':True,'transparent_png_count':0,'opaque_icon_png_count':0,'pdfs_have_no_image_objects':True,'ico_sizes':sorted([list(s) for s in Image.open(P/'icons/favicon.ico').ico.sizes()])}
for file in P.rglob('*.svg'):
    tree=ET.parse(file);assert tree.findall('.//'+tag('path'));assert not tree.findall('.//'+tag('image'));assert not tree.findall('.//'+tag('text'))
for file in (P/'png').rglob('*.png'):
    im=Image.open(file);im.verify();im=Image.open(file).convert('RGBA');assert im.getchannel('A').getextrema()==(0,255)
    expected_rgb=(255,255,255) if '/white/' in str(file) else (0,0,0)
    assert all((r,g,b)==expected_rgb for r,g,b,a in im.getdata() if a>0)
    validation['transparent_png_count']+=1
for file in (P/'icons').glob('*.png'):
    im=Image.open(file);assert im.mode=='RGB';validation['opaque_icon_png_count']+=1
for file in (P/'pdf').glob('*.pdf'):assert b'/Subtype /Image' not in file.read_bytes()
report={'source_sha256':expected,'composition':{'viewBox':[0,0,1403,324],'symbol_box':[0,0,276,324],'wordmark_box':[362,84,1041,240],'gap':86,'bottom_alignment_y':324},'tracing':{'tool':'Potrace 1.16','input':'4x Lanczos interpolation; alpha >= 128 silhouette','options':'-s -t 0 -O 0.2 -u 100','limitation':'Raster contour approximation, not recovery of original authoring curves. Wordmark screenshot antialiasing was reconstructed; no font substitution or regeneration.'},'fidelity':metrics,'validation':validation}
(SRC/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
# Manifest excludes itself to avoid recursive hashes.
manifest={'brand':'Wokiee','approved':'2026-09-23','files':[{'path':str(p.relative_to(P)),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(P.rglob('*')) if p.is_file() and p.name!='manifest.json']}
(P/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=P.parent/'Wokiee-Logo-Package.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(P.rglob('*')):
        if p.is_file():z.write(p,Path('Wokiee-Logo-Package')/p.relative_to(P))
print(json.dumps(report,indent=2));print('PACKAGE',P);print('ARCHIVE',archive)
