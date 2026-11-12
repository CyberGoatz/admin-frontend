import {
    AbstractControl,
    UntypedFormControl,
    UntypedFormGroup,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import {SandboxDefinition} from '@crczp/sandbox-model';

const PATH_ALLOWED_CHARACTERS = /^[A-Za-z0-9._/-]*$/;

/**
 * Removes surrounding whitespace and leading and trailing slashes (same normalization as the server)
 */
export function normalizeDefinitionPath(value: string | null | undefined): string {
    return (value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

/**
 * Validates optional folder in repository: only A-Za-z0-9._/- characters and no '..' segment.
 * Empty value is valid (repository root).
 */
export function definitionPathValidator(
    control: AbstractControl,
): ValidationErrors | null {
    const path = normalizeDefinitionPath(control.value as string);
    if (!path) {
        return null;
    }
    if (!PATH_ALLOWED_CHARACTERS.test(path)) {
        return {pathCharacters: true};
    }
    if (path.split('/').includes('..')) {
        return {pathParentSegment: true};
    }
    return null;
}

/**
 * Sandbox Definition create form
 */
export class SandboxDefinitionFormGroup {
    formGroup: UntypedFormGroup;

    constructor() {
        this.formGroup = new UntypedFormGroup({
            gitUrl: new UntypedFormControl('', Validators.required),
            revision: new UntypedFormControl('', Validators.required),
            path: new UntypedFormControl('', definitionPathValidator),
        });
    }

    createFromValues(): SandboxDefinition {
        const definition = new SandboxDefinition();
        definition.url = this.formGroup.get('gitUrl').value.trim();
        definition.rev = this.formGroup.get('revision').value.trim();
        definition.path = normalizeDefinitionPath(this.formGroup.get('path').value);
        return definition;
    }
}
