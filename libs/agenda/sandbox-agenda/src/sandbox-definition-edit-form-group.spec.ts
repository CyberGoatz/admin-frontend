import { describe, expect, it } from 'vitest';
import {
    normalizeDefinitionPath,
    SandboxDefinitionFormGroup,
} from '../sandbox-definition-edit/components/sandbox-definition-edit-form-group';

function createForm(path: string): SandboxDefinitionFormGroup {
    const form = new SandboxDefinitionFormGroup();
    form.formGroup.setValue({
        gitUrl: ' https://git.example.com/repo.git ',
        revision: ' main ',
        path,
    });
    return form;
}

describe('SandboxDefinitionFormGroup path', () => {
    it('is valid and empty when path is not filled in', () => {
        const form = createForm('');
        expect(form.formGroup.valid).toBe(true);
        expect(form.createFromValues().path).toBe('');
    });

    it.each(['labs/course/training-1', 'a.b_c-d', 'folder/'])(
        'accepts %s',
        (path) => {
            expect(createForm(path).formGroup.get('path')?.valid).toBe(true);
        },
    );

    it.each(['a b', 'a\\b', 'föö', 'a*b'])('rejects characters in %s', (path) => {
        const control = createForm(path).formGroup.get('path');
        expect(control?.hasError('pathCharacters')).toBe(true);
    });

    it.each(['..', '../x', 'a/../b', 'a/..'])('rejects parent segment in %s', (path) => {
        const control = createForm(path).formGroup.get('path');
        expect(control?.hasError('pathParentSegment')).toBe(true);
    });

    it('accepts dots inside a segment name', () => {
        expect(createForm('a/..b/c..').formGroup.get('path')?.valid).toBe(true);
    });

    it('strips whitespace and surrounding slashes in the created definition', () => {
        const definition = createForm(' /labs/x/ ').createFromValues();
        expect(definition.url).toBe('https://git.example.com/repo.git');
        expect(definition.rev).toBe('main');
        expect(definition.path).toBe('labs/x');
    });

    it('normalizes empty-like values to an empty string', () => {
        expect(normalizeDefinitionPath('/')).toBe('');
        expect(normalizeDefinitionPath(null)).toBe('');
    });
});
