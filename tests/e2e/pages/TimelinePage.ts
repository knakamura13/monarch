import type { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DialogComponent } from '../components/DialogComponent';

export class TimelinePage extends BasePage {
    readonly dialog: DialogComponent;

    constructor(page: Page) {
        super(page);
        this.dialog = new DialogComponent(page);
    }

    async goto() {
        await super.goto('/timeline');
        await this.page.waitForLoadState('networkidle');
    }

    /** Each phase has its own "Add milestone to <Phase>" button. Pick by phase label. */
    getAddMilestoneButton(phaseLabel: string) {
        return this.page.getByRole('button', { name: `Add milestone to ${phaseLabel}` });
    }

    getMilestoneCard(title: string) {
        return this.page.locator('.milestone-wrapper').filter({ has: this.page.getByText(title, { exact: true }) }).first();
    }

    getPhaseContainer(phase: string) {
        return this.page.locator(`section:has(h2:text("${phase}"))`);
    }

    async dragMilestoneToPhase(title: string, phase: string) {
        const card = this.getMilestoneCard(title);
        const handle = card.locator('.milestone-drag-handle');
        const target = this.getPhaseContainer(phase);
        await handle.dragTo(target);
    }

    async dragMilestone(title: string, yOffset: number) {
        const milestone = this.getMilestoneCard(title);
        
        await milestone.hover();
        await this.page.mouse.down();
        // Move slightly to trigger drag threshold
        await this.page.mouse.move(0, 10);
        
        // Move by requested offset
        const box = await milestone.boundingBox();
        if (box) {
            await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + yOffset);
        }
        await this.page.mouse.up();
        await this.page.waitForLoadState('networkidle');
    }
}
