import { describe, expect, it } from 'vitest';
import { SandboxDefinitionDTO } from '../../dto/sandbox-definition/sandbox-definition-dto';
import { SandboxDefinitionMapper } from './sandbox-definition-mapper';

function createDTO(path?: string): SandboxDefinitionDTO {
    return {
        id: 1,
        name: 'definition',
        rev: 'main',
        url: 'https://git.example.com/repo.git',
        ...(path === undefined ? {} : { path }),
        created_by: {
            id: 1,
            sub: 'sub',
            full_name: 'Name',
            mail: 'a@b.c',
        },
    };
}

describe('SandboxDefinitionMapper', () => {
    it('maps path from the DTO', () => {
        expect(SandboxDefinitionMapper.fromDTO(createDTO('labs/x')).path).toBe('labs/x');
    });

    it('maps missing path to the repository root', () => {
        expect(SandboxDefinitionMapper.fromDTO(createDTO()).path).toBe('');
        expect(SandboxDefinitionMapper.fromDTO(createDTO('')).path).toBe('');
    });
});
