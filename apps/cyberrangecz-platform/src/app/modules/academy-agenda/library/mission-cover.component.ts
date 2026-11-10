import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { LibraryMission } from '../../../academy/academy.model';
import { stackIcon } from './mission-stack';

interface CoverNode {
    x: number;
    y: number;
    name: string;
    os: string;
    icon: string | null;
    hidden: boolean;
    attacker: boolean;
}

interface CoverNetwork {
    x: number;
    width: number;
    name: string;
    nodes: CoverNode[];
}

const W = 320;
const H = 168;
const ROUTER_Y = 26;
const SWITCH_Y = 70;
const NODE_Y = 92;
const NODE_W = 62;
const NODE_H = 52;

/**
 * A mission's cover: its lab range drawn from the topology, one router with
 * its networks and their hosts. Tinted by what students do in the lab.
 */
@Component({
    selector: 'crczp-academy-mission-cover',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <svg
            [attr.viewBox]="'0 0 ' + width + ' ' + height"
            role="img"
            [attr.aria-label]="label()"
            [class]="'cover cover-' + (mission().work ?? 'none')"
            [class.compact]="compact()"
        >
            <rect
                class="bg"
                x="0"
                y="0"
                [attr.width]="width"
                [attr.height]="height"
                rx="8"
            />
            @if (networks().length) {
                <g class="router">
                    <rect
                        [attr.x]="width / 2 - 22"
                        [attr.y]="ROUTER_Y - 10"
                        width="44"
                        height="20"
                        rx="10"
                    />
                    @if (!compact()) {
                        <text
                            [attr.x]="width / 2"
                            [attr.y]="ROUTER_Y + 4"
                            text-anchor="middle"
                        >
                            router
                        </text>
                    }
                </g>
                @for (net of networks(); track net.name) {
                    <line
                        class="wire"
                        [attr.x1]="width / 2"
                        [attr.y1]="ROUTER_Y + 10"
                        [attr.x2]="net.x"
                        [attr.y2]="SWITCH_Y"
                    />
                    <rect
                        class="switch"
                        [attr.x]="net.x - net.width / 2"
                        [attr.y]="SWITCH_Y - 3"
                        [attr.width]="net.width"
                        height="6"
                        rx="3"
                    />
                    @if (!compact()) {
                        <text
                            class="net-name"
                            [attr.x]="net.x"
                            [attr.y]="SWITCH_Y - 8"
                            text-anchor="middle"
                        >
                            {{ net.name }}
                        </text>
                    }
                    @for (node of net.nodes; track node.name) {
                        <line
                            class="wire"
                            [attr.x1]="node.x"
                            [attr.y1]="SWITCH_Y + 3"
                            [attr.x2]="node.x"
                            [attr.y2]="node.y"
                        />
                        <g
                            class="node"
                            [class.hidden-host]="node.hidden"
                            [class.attacker]="node.attacker"
                        >
                            <rect
                                [attr.x]="node.x - NODE_W / 2"
                                [attr.y]="node.y"
                                [attr.width]="NODE_W"
                                [attr.height]="NODE_H"
                                rx="8"
                            />
                            @if (node.icon) {
                                <image
                                    [attr.href]="node.icon"
                                    [attr.x]="node.x - 9"
                                    [attr.y]="node.y + 8"
                                    width="18"
                                    height="18"
                                />
                            }
                            @if (!compact()) {
                                <text
                                    class="host-name"
                                    [attr.x]="node.x"
                                    [attr.y]="node.y + 39"
                                    text-anchor="middle"
                                >
                                    {{ node.name }}
                                </text>
                            }
                        </g>
                    }
                }
            }
        </svg>
    `,
    styles: `
        :host {
            display: block;
            line-height: 0;
        }
        .cover {
            width: 100%;
            height: auto;
            display: block;
            --c-bg: var(--surface-muted);
            --c-line: var(--border);
            --c-accent: var(--text-subtle);
        }
        .cover-attack {
            --c-bg: #fef3f2;
            --c-line: #fecdca;
            --c-accent: #b42318;
        }
        .cover-defend {
            --c-bg: #ecfdf3;
            --c-line: #abefc6;
            --c-accent: #067647;
        }
        .cover-investigate {
            --c-bg: #eff4ff;
            --c-line: #c7d7fe;
            --c-accent: #2f4f7f;
        }
        .bg {
            fill: var(--c-bg);
        }
        .wire {
            stroke: var(--c-line);
            stroke-width: 1.5;
        }
        .switch {
            fill: var(--c-accent);
            opacity: 0.55;
        }
        .router rect {
            fill: #fff;
            stroke: var(--c-accent);
            stroke-width: 1.25;
        }
        .node rect {
            fill: #fff;
            stroke: var(--c-line);
            stroke-width: 1.25;
        }
        .node.attacker rect {
            stroke: var(--c-accent);
        }
        .node.hidden-host rect {
            stroke-dasharray: 4 3;
            fill: transparent;
        }
        .node image {
            opacity: 0.72;
        }
        text {
            font-family: var(--font-sans);
            font-size: 10px;
            fill: var(--text-muted);
        }
        .router text {
            font-size: 9px;
            fill: var(--c-accent);
        }
        .net-name {
            font-family: var(--font-mono);
            font-size: 9px;
            fill: var(--text-subtle);
        }
        .host-name {
            font-weight: 500;
            fill: var(--text);
        }
        .compact .wire {
            stroke-width: 3;
        }
        .compact .node rect,
        .compact .router rect {
            stroke-width: 2.5;
        }
    `,
})
export class MissionCoverComponent {
    readonly mission = input.required<LibraryMission>();
    /** Small thumbnail without labels. */
    readonly compact = input(false);

    readonly width = W;
    readonly height = H;
    readonly ROUTER_Y = ROUTER_Y;
    readonly SWITCH_Y = SWITCH_Y;
    readonly NODE_W = NODE_W;
    readonly NODE_H = NODE_H;

    readonly networks = computed<CoverNetwork[]>(() => {
        const lab = this.mission().lab ?? [];
        const slot = W / Math.max(lab.length, 1);
        return lab.map((net, i) => {
            const x = slot * (i + 0.5);
            const spacing = Math.min(
                NODE_W + 10,
                (slot - 12) / Math.max(net.hosts.length, 1),
            );
            const span = spacing * (net.hosts.length - 1);
            return {
                x,
                width: Math.max(span + NODE_W * 0.7, 56),
                name: net.name,
                nodes: net.hosts.map((host, j) => ({
                    x: x - span / 2 + spacing * j,
                    y: NODE_Y,
                    name: host.name,
                    os: host.os,
                    icon: stackIcon(host.os),
                    hidden: !!host.hidden,
                    attacker: host.role === 'attacker',
                })),
            };
        });
    });

    readonly label = computed(() => {
        const hosts = (this.mission().lab ?? []).flatMap((n) =>
            n.hosts.map((h) => `${h.name} (${h.os})`),
        );
        return hosts.length ? `Lab range: ${hosts.join(', ')}` : 'Lab range';
    });
}
