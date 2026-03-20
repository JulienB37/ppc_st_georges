import z from 'zod'

const matcheSchema = z.object({
    equipe_st_georges: z.string(),
    equipe_adverse: z.string()
})

const groupeSchema = z.object({
    domicile: z.boolean(),
    date: z.string(),
    matches: z.array(matcheSchema)
})

const configSchema = z.object({
    journee: z.int(),
    groupes: z.array(groupeSchema)    
})

export type Config = z.infer<typeof configSchema> 
export type ConfigGroupe = z.infer<typeof groupeSchema>
export type ConfigMatche = z.infer<typeof matcheSchema>

export class Configuration {


    private _config: Config

    get config(): Config {
        return {...this._config}
    }

    constructor(data: string) {
        const dataObj = JSON.parse(data)
        this._config = configSchema.parse(dataObj)
    }
}