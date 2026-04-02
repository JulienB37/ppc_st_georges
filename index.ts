import { createSVGWindow } from 'svgdom'
import { Container, SVG, registerWindow } from '@svgdotjs/svg.js'
import { Configuration } from './class/config.class'
import { SvgDraw } from './class/draw.class'
import { Resvg } from '@resvg/resvg-js'

const startPosition = {
    x: 10,
    y: 90
}
const width = 212

// returns a window with a document and an svg root node
const window = createSVGWindow()
const document = window.document

// register window and document
registerWindow(window, document)

const templateFile = Bun.file('template.svg')
const configFile = Bun.file('journee_config.json')
const svgTeamplate = await templateFile.text()

const config = new Configuration(await configFile.text()).config

if (config.adulte) {
    const canvas = SVG(svgTeamplate) as Container

    const arialBuffer = await Bun.file('fonts/arial.ttf').arrayBuffer()
    const arialBoldBuffer = await Bun.file('fonts/arialbd.ttf').arrayBuffer()
    const comicBuffer = await Bun.file('fonts/ComicSansMS.ttf').arrayBuffer()
    const comicBoldBuffer = await Bun.file('fonts/comicbd.ttf').arrayBuffer()
    const arialBase64 = Buffer.from(arialBuffer).toString('base64')
    const arialBoldBase64 = Buffer.from(arialBoldBuffer).toString('base64')
    const comicBase64 = Buffer.from(comicBuffer).toString('base64')
    const comicBoldBase64 = Buffer.from(comicBoldBuffer).toString('base64')

    const fontStyle = `<style>
        @font-face { font-family: 'Arial'; font-weight: normal; src: url('data:font/truetype;base64,${arialBase64}') format('truetype'); }
        @font-face { font-family: 'Arial'; font-weight: bold; src: url('data:font/truetype;base64,${arialBoldBase64}') format('truetype'); }
        @font-face { font-family: 'Comic Sans MS'; font-weight: normal; src: url('data:font/truetype;base64,${comicBase64}') format('truetype'); }
        @font-face { font-family: 'Comic Sans MS'; font-weight: bold; src: url('data:font/truetype;base64,${comicBoldBase64}') format('truetype'); }
        @font-face { font-family: 'Sans'; font-weight: normal; src: url('data:font/truetype;base64,${comicBase64}') format('truetype'); }
        @font-face { font-family: 'Sans'; font-weight: bold; src: url('data:font/truetype;base64,${comicBoldBase64}') format('truetype'); }
    </style>`

    const draw = new SvgDraw(canvas)

    const confAdulte = config.adulte 
    const x = startPosition.x
    let y = startPosition.y
    
    for (const groupe of confAdulte.groupes) {
        y = await draw.drawGroup(groupe, x, y, width)
    }
    
    
    canvas.text(`${confAdulte.journee}${confAdulte.journee === 1 ? 'ere' : 'eme'} JOURNEE`)
        .font({
            family: 'Arial',
            size: 10,
            weight: 'bold'
    
        })
        .fill('red')
        .stroke({ 
            color: 'red',
            width: 0.5
        })
        .rotate(-7.3)
        .move(118, 68)
    
    
    await draw.drawSponsors()
    
    // Supprimer width/height pour que resvg respecte fitTo
    canvas.attr('width', null)
    canvas.attr('height', null)
    
    const rawSvg = canvas.svg()
    const svgString = rawSvg.replace(/<svg/, `<svg`) .replace(/(<svg[^>]*>)/, `$1${fontStyle}`)
    await Bun.write(`resultats/svg/${confAdulte.journee}_journee.svg`, svgString)
    
    const resvg = new Resvg(svgString, {
        fitTo: { mode: 'width', value: 2400 },
        font: {
            fontFiles: [
                'fonts/ComicSansMS.ttf',
                'fonts/comicbd.ttf',
                'fonts/arial.ttf',
                'fonts/arialbd.ttf'
            ],
            loadSystemFonts: false,
        }
    })
    const pngBuffer = resvg.render().asPng()
    await Bun.write(`resultats/png/${confAdulte.journee}_journee.png`, pngBuffer)
}

if (config.enfant) {
    const canvas = SVG(svgTeamplate) as Container

    const arialBuffer = await Bun.file('fonts/arial.ttf').arrayBuffer()
    const arialBoldBuffer = await Bun.file('fonts/arialbd.ttf').arrayBuffer()
    const comicBuffer = await Bun.file('fonts/ComicSansMS.ttf').arrayBuffer()
    const comicBoldBuffer = await Bun.file('fonts/comicbd.ttf').arrayBuffer()
    const arialBase64 = Buffer.from(arialBuffer).toString('base64')
    const arialBoldBase64 = Buffer.from(arialBoldBuffer).toString('base64')
    const comicBase64 = Buffer.from(comicBuffer).toString('base64')
    const comicBoldBase64 = Buffer.from(comicBoldBuffer).toString('base64')

    const fontStyle = `<style>
        @font-face { font-family: 'Arial'; font-weight: normal; src: url('data:font/truetype;base64,${arialBase64}') format('truetype'); }
        @font-face { font-family: 'Arial'; font-weight: bold; src: url('data:font/truetype;base64,${arialBoldBase64}') format('truetype'); }
        @font-face { font-family: 'Comic Sans MS'; font-weight: normal; src: url('data:font/truetype;base64,${comicBase64}') format('truetype'); }
        @font-face { font-family: 'Comic Sans MS'; font-weight: bold; src: url('data:font/truetype;base64,${comicBoldBase64}') format('truetype'); }
        @font-face { font-family: 'Sans'; font-weight: normal; src: url('data:font/truetype;base64,${comicBase64}') format('truetype'); }
        @font-face { font-family: 'Sans'; font-weight: bold; src: url('data:font/truetype;base64,${comicBoldBase64}') format('truetype'); }
    </style>`

    const draw = new SvgDraw(canvas)

    const confEnfant = config.enfant 
    const x = startPosition.x
    let y = startPosition.y
    
    draw.drawMatchEnfant(confEnfant, x, y, width)
    
    canvas.text(`${confEnfant.journee}${confEnfant.journee === 1 ? 'ere' : 'eme'} JOURNEE`)
        .font({
            family: 'Arial',
            size: 10,
            weight: 'bold'
    
        })
        .fill('red')
        .stroke({ 
            color: 'red',
            width: 0.5
        })
        .rotate(-7.3)
        .move(118, 68)

    canvas.text(`JEUNES`)
        .font({
            family: 'Arial',
            size: 15,
            weight: 'bold'
    
        })
        .fill('lime')
        .stroke({ 
            color: 'lime',
            width: 0.5
        })
        .rotate(-7.5)
        .move(125, 50)
    
    
    await draw.drawSponsors()
    
    // Supprimer width/height pour que resvg respecte fitTo
    canvas.attr('width', null)
    canvas.attr('height', null)
    
    const rawSvg = canvas.svg()
    const svgString = rawSvg.replace(/<svg/, `<svg`) .replace(/(<svg[^>]*>)/, `$1${fontStyle}`)
    await Bun.write(`resultats/svg/${confEnfant.journee}_journee_jeune.svg`, svgString)
    
    const resvg = new Resvg(svgString, {
        fitTo: { mode: 'width', value: 2400 },
        font: {
            fontFiles: [
                'fonts/ComicSansMS.ttf',
                'fonts/comicbd.ttf',
                'fonts/arial.ttf',
                'fonts/arialbd.ttf'
            ],
            loadSystemFonts: false,
        }
    })
    const pngBuffer = resvg.render().asPng()
    await Bun.write(`resultats/png/${confEnfant.journee}_journee_jeune.png`, pngBuffer)
}
