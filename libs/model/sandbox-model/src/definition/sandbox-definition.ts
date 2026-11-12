/**
 * Class representing sandbox definition in a system
 */

import {CreatedBy} from '../pool/created-by';

export class SandboxDefinition {
    id!: number;
    title!: string;
    url?: string;
    rev!: string;
    /** Folder in the repository, empty string means the repository root */
    path = '';
    createdBy!: CreatedBy;

    toString(): string {
        return this.title;
    }
}
