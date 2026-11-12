import {CreatedByDTO} from '../sandbox-instance/created-by-dto';

export class SandboxDefinitionDTO {
    id: number;
    name: string;
    rev: string;
    url?: string;
    path?: string;
    created_by: CreatedByDTO;
}
