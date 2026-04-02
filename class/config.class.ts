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

const adulteSchema = z.object({
    journee: z.int(),
    groupes: z.array(groupeSchema)
})

// -----------------------

const matcheEnfantSchema = z.object({
    equipe_st_georges: z.string(),
    equipe_adverse: z.string(),
    domicile: z.boolean(),
})

const enfantSchema = z.object({
    journee: z.int(),
    date: z.string(),
    matche_1: matcheEnfantSchema,
    matche_2: matcheEnfantSchema,
})

// -----------------------

const configSchema = z.object({
    adulte: adulteSchema.optional(),        
    enfant: enfantSchema.optional()        
})

export type Config = z.infer<typeof configSchema> 
export type ConfigGroupe = z.infer<typeof groupeSchema>
export type ConfigMatche = z.infer<typeof matcheSchema>
export type ConfigEnfant = z.infer<typeof enfantSchema>
export type ConfigMatchEnfant = z.infer<typeof matcheEnfantSchema>

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