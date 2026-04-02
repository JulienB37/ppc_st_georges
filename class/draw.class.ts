import { Container } from '@svgdotjs/svg.js'
import type { ConfigGroupe, ConfigMatche } from './config.class'
import path from "path"
import { imageSizeFromFile } from 'image-size/fromFile'

export class SvgDraw {
    private _teamHeigth = 18
    private _teamFontSize = 8
    private _teamGap = 2
    private _strokeWidth = 0.5

    constructor(private _canvas: Container) {}

    public async drawGroup( groupe: ConfigGroupe, x: number, y: number, width: number) {
        this._canvas.text(`${groupe.date} - ${groupe.domicile ? 'A domicile' : 'A l\'exterieur'}`)
        .font({
            family:   'Arial',
            size:     5,
            weight: 'bold'
        })
        .move(x + 20, y)

        this._canvas.line([x + 10, y + 8, x + width - 10, y + 8])
            .stroke({ width: this._strokeWidth, color: 'black' })
            
        return this.drawMatches(groupe.matches, groupe.domicile, x + 10, y + 10, width - 20)
    }

    private async drawMatches(matches: ConfigMatche[], domicile: boolean, x: number, y: number, width: number): Promise<number> {
        
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i]
            if (!match) {
                continue
            }

            if (domicile) {
                this._canvas
                    .path(`
                        M ${x + this._teamHeigth  / 2} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2} 
                        V ${(y + ((this._teamHeigth + this._teamGap) * i))  + 2} 
                        H ${x + ((width - this._teamHeigth / 2) / 3) - this._teamHeigth / 4}
                        A ${(this._teamHeigth - 4) / 2} ${(this._teamHeigth - 4) / 2} 0 0 0 ${x + ((width - this._teamHeigth / 2) / 3) - this._teamHeigth / 4} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2}
                        Z
                        M ${x + width - this._teamHeigth  / 2} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2}
                        V ${(y + ((this._teamHeigth + this._teamGap) * i)) + 2}
                        H ${x + ((width - this._teamHeigth / 2) / 3) + this._teamHeigth / 4}
                        A ${(this._teamHeigth - 4) / 2} ${(this._teamHeigth - 4) / 2} 0 0 1 ${x + ((width - this._teamHeigth / 2) / 3) + this._teamHeigth / 4} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2}
                        Z
                    `)
                    .fill('white')
                    .stroke({ 
                        color: 'black',
                        width: this._strokeWidth
                    })

                this._canvas.text(match.equipe_st_georges)
                    .font({
                        family: 'Comic Sans MS',
                        size: this._teamFontSize,
                    })
                    .move(x + this._teamHeigth + 4, (y + (this._teamHeigth - (this._teamFontSize + this._teamGap * 2)) / 2)  + ((this._teamHeigth + this._teamGap) * i))

                this._canvas.text(match.equipe_adverse)
                    .font({
                        family: 'Comic Sans MS',
                        size: this._teamFontSize,
                    })
                    .move(x - 2 + ((width - this._teamHeigth / 2) / 3) + this._teamHeigth 
                    , (y + (this._teamHeigth - (this._teamFontSize + this._teamGap * 2)) / 2)  + ((this._teamHeigth + this._teamGap) * i))

                this._canvas.text('VS')
                    .font({
                        family: 'Comic Sans MS',
                        size: this._teamFontSize,
                        weight: 'bold'
                    })
                    .move(x + ((width - this._teamHeigth / 2) / 3) - this._teamHeigth / 4, (y + (this._teamHeigth - (this._teamFontSize + this._teamGap * 2)) / 2)  + ((this._teamHeigth + this._teamGap) * i))
            } else {
                this._canvas
                    .path(`
                        M ${x + width - this._teamHeigth / 2} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2} 
                        V ${(y + ((this._teamHeigth + this._teamGap) * i))  + 2} 
                        H ${x + width - ((width - this._teamHeigth / 2) / 3) + this._teamHeigth / 4}
                        A ${(this._teamHeigth - 4) / 2} ${(this._teamHeigth - 4) / 2} 0 0 1 ${x + width - ((width - this._teamHeigth / 2) / 3) + this._teamHeigth / 4} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2}
                        Z
                        M ${x + this._teamHeigth / 2} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2}
                        V ${(y + ((this._teamHeigth + this._teamGap) * i)) + 2}
                        H ${x + width - ((width - this._teamHeigth / 2) / 3) - this._teamHeigth / 4}
                        A ${(this._teamHeigth - 4) / 2} ${(this._teamHeigth - 4) / 2} 0 0 0 ${x + width - ((width - this._teamHeigth / 2) / 3) - this._teamHeigth / 4} ${(y + ((this._teamHeigth + this._teamGap) * i)) + this._teamHeigth - 2}
                        Z
                    `)
                    .fill('white')
                    .stroke({ 
                        color: 'black',
                        width: this._strokeWidth
                    })
                
                this._canvas.text(match.equipe_adverse)
                    .font({
                        family: 'Comic Sans MS',
                        size: this._teamFontSize,
                    })
                    .move(x + this._teamHeigth + 4, (y + (this._teamHeigth - (this._teamFontSize + this._teamGap * 2)) / 2)  + ((this._teamHeigth + this._teamGap) * i))
            
                this._canvas.text(match.equipe_st_georges)
                    .font({
                        family: 'Comic Sans MS',
                        size: this._teamFontSize,
                    })
                    .move(x + width - 2 - ((width - this._teamHeigth / 2) / 3) +  this._teamHeigth , (y + (this._teamHeigth - (this._teamFontSize + this._teamGap * 2)) / 2)  + ((this._teamHeigth + this._teamGap) * i))
            
                this._canvas.text('VS')
                    .font({
                        family: 'Comic Sans MS',
                        size: this._teamFontSize,
                        weight: 'bold'
                    })
                    .move(x + width - ((width - this._teamHeigth / 2) / 3) - this._teamHeigth / 4, (y + (this._teamHeigth - (this._teamFontSize + this._teamGap * 2)) / 2)  + ((this._teamHeigth + this._teamGap) * i))
            }       
            
            this._canvas.circle(this._teamHeigth)
                .fill('white')
                .stroke({ 
                    color: 'black',
                    width: this._strokeWidth
                })
                .move(x, y + ((this._teamHeigth + this._teamGap) * i))
            
            this._canvas.circle(this._teamHeigth)
                .fill('white')
                .stroke({ 
                    color: 'black',
                    width: this._strokeWidth
                })
                .move(x + (width - this._teamHeigth), y + ((this._teamHeigth + this._teamGap) * i))

            if (domicile) {
                await this.drawImage('PP St Georges/Cher', x + 3, y + 3 + ((this._teamHeigth + this._teamGap) * i))
                await this.drawImage(match.equipe_adverse, x + (width - this._teamHeigth) + 3, y + 3 + ((this._teamHeigth + this._teamGap) * i))
            } else {
                await this.drawImage('PP St Georges/Cher', x + (width - this._teamHeigth) + 3, y + 3 + ((this._teamHeigth + this._teamGap) * i))
                await this.drawImage(match.equipe_adverse, x + 3, y + 3 + ((this._teamHeigth + this._teamGap) * i))
            }
         }


        return y + ((this._teamHeigth + this._teamGap) * matches.length)
    }

    private async drawImage(equipe: string, x: number, y: number) {
        const extensions = ['png', 'jpg', 'jpeg']
        let fileext = ''
        const dir = import.meta.dir

        equipe = equipe
        .normalize('NFD')
        .toUpperCase()
        .toLowerCase()
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[\p{P}]/gu, '')
        .replaceAll(/^(.*)\s+[0-9]+$/gm, '$1')
        .replaceAll(' ', '_')
        
        let filePath: string | null = null
        for (const ext of extensions) {
            const fp = path.join(dir, '../images/logo_club', equipe + '.' + ext)
            if (await Bun.file(fp).exists()) {
                filePath = fp
                fileext = ext
                break
            }
        }

        if (!filePath) {
            console.log('Aucun log club trouvé :', equipe)
            const fp = path.join(dir, '../images/logo_club/default.png')
            if (await Bun.file(fp).exists()) {
                filePath = fp
                fileext = 'png'
            }
        }

        if (filePath) {
            const buffer = await Bun.file(filePath).arrayBuffer()
            const base64 = Buffer.from(buffer).toString('base64')
            const size = this._teamHeigth - 6
            this._canvas.image(`data:image/${fileext};base64,${base64}`)
                .size(size, size)
                .attr('preserveAspectRatio', 'xMidYMid meet')
                .move(x, y)
        } 
    }

    public async drawSponsors () {
        const maxWidth = 52
        const maxHeight = 32
        const gap = 4
        let y = 176
        const dir = import.meta.dir
        const sponsorsDir = 'images/logo_sponsors'
        const glob = new Bun.Glob("**/*.{png,jpg,jpeg}");

        let images = await Array.fromAsync(glob.scan(sponsorsDir));

        for (let i = 0; i < 3; i++) {
            
            const randomImage: string = images[Math.floor(Math.random() * images.length)] as string
            try {
            
            const filePath = path.join(sponsorsDir, randomImage)
            const ext = path.extname(randomImage).slice(1).toLowerCase()
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
            const buffer = await Bun.file(filePath).arrayBuffer()
            const meta = await imageSizeFromFile(filePath)
            const ratio = meta.width / meta.height
    
            const heightFromWidth = Math.round(maxWidth / ratio)
            const widthFromHeight = Math.round(maxHeight * ratio)
    
            const newWidth = heightFromWidth > maxHeight ? widthFromHeight : maxWidth
            const newHeight = heightFromWidth > maxHeight ? maxHeight : heightFromWidth
    
                const base64 = Buffer.from(buffer).toString('base64')
                this._canvas.image(`data:${mimeType};base64,${base64}`)
                    .size(newWidth, newHeight)
                    .move(230 + (maxWidth - newWidth) / 2, y)
                y += newHeight + gap
                images = images.filter(img => img !== randomImage)
            } catch (e) {
                console.error('Error drawing sponsor image:',randomImage)
            }

        }
    }
}    