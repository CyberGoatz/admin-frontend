import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type IconNode = [tag: 'path' | 'circle' | 'rect' | 'line', attrs: Record<string, string>][];

/**
 * Stroke icons for the campus shell, copied from lucide v1.14.0
 * (https://lucide.dev, ISC license, Copyright (c) Lucide Contributors).
 */
const ICONS: Record<string, IconNode> = {
    users: [
        ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
        ['path', { d: 'M16 3.128a4 4 0 0 1 0 7.744' }],
        ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
        ['circle', { cx: '9', cy: '7', r: '4' }],
    ],
    'book-open': [
        ['path', { d: 'M12 7v14' }],
        [
            'path',
            {
                d: 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
            },
        ],
    ],
    'library-big': [
        ['rect', { width: '8', height: '18', x: '3', y: '3', rx: '1' }],
        ['path', { d: 'M7 3v18' }],
        [
            'path',
            {
                d: 'M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z',
            },
        ],
    ],
    'file-pen-line': [
        [
            'path',
            {
                d: 'M14.364 13.634a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506l4.013-4.009a1 1 0 0 0-3.004-3.004z',
            },
        ],
        ['path', { d: 'M14.487 7.858A1 1 0 0 1 14 7V2' }],
        [
            'path',
            {
                d: 'M20 19.645V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l2.516 2.516',
            },
        ],
        ['path', { d: 'M8 18h1' }],
    ],
    server: [
        ['rect', { width: '20', height: '8', x: '2', y: '2', rx: '2', ry: '2' }],
        ['rect', { width: '20', height: '8', x: '2', y: '14', rx: '2', ry: '2' }],
        ['line', { x1: '6', x2: '6.01', y1: '6', y2: '6' }],
        ['line', { x1: '6', x2: '6.01', y1: '18', y2: '18' }],
    ],
    'log-out': [
        ['path', { d: 'm16 17 5-5-5-5' }],
        ['path', { d: 'M21 12H9' }],
        ['path', { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }],
    ],
    'chevrons-left': [
        ['path', { d: 'm11 17-5-5 5-5' }],
        ['path', { d: 'm18 17-5-5 5-5' }],
    ],
    'chevrons-right': [
        ['path', { d: 'm6 17 5-5-5-5' }],
        ['path', { d: 'm13 17 5-5-5-5' }],
    ],
    'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
    circle: [['circle', { cx: '12', cy: '12', r: '4' }]],
};

@Component({
    selector: 'crczp-lucide-icon',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { 'aria-hidden': 'true', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
    styles: `
        :host {
            display: inline-flex;
            flex: 0 0 auto;
        }
        svg {
            width: 100%;
            height: 100%;
        }
    `,
    template: `
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            [attr.stroke-width]="strokeWidth()"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            @for (node of nodes(); track $index) {
                @switch (node[0]) {
                    @case ('path') {
                        <svg:path [attr.d]="node[1]['d']" />
                    }
                    @case ('circle') {
                        <svg:circle [attr.cx]="node[1]['cx']" [attr.cy]="node[1]['cy']" [attr.r]="node[1]['r']" />
                    }
                    @case ('rect') {
                        <svg:rect
                            [attr.x]="node[1]['x']"
                            [attr.y]="node[1]['y']"
                            [attr.width]="node[1]['width']"
                            [attr.height]="node[1]['height']"
                            [attr.rx]="node[1]['rx']"
                            [attr.ry]="node[1]['ry']"
                        />
                    }
                    @case ('line') {
                        <svg:line [attr.x1]="node[1]['x1']" [attr.y1]="node[1]['y1']" [attr.x2]="node[1]['x2']" [attr.y2]="node[1]['y2']" />
                    }
                }
            }
        </svg>
    `,
})
export class LucideIconComponent {
    readonly name = input.required<string>();
    readonly size = input(18);
    readonly strokeWidth = input(2);
    readonly nodes = computed(() => ICONS[this.name()] ?? ICONS['circle']);
}
