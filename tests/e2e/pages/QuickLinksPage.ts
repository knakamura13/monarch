import { type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class QuickLinksPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    async goto() {
        await super.goto('/quick-links');
        await this.page.waitForLoadState('networkidle');
    }

    getLinkTile(title: string) {
        return this.page.locator('.ql-item[data-kind="link"]').filter({ has: this.page.getByText(title, { exact: true }) }).first();
    }

    getFolderTile(name: string) {
        return this.page.locator('.ql-item[data-kind="folder"]').filter({ has: this.page.getByText(name, { exact: true }) }).first();
    }

    async dragToReorder(sourceTitle: string, targetTitle: string, kind: 'link' | 'folder' = 'link') {
        const source = kind === 'link' ? this.getLinkTile(sourceTitle) : this.getFolderTile(sourceTitle);
        const target = kind === 'link' ? this.getLinkTile(targetTitle) : this.getFolderTile(targetTitle);

        const sourceBox = await source.boundingBox();
        const targetBox = await target.boundingBox();
        if (!sourceBox || !targetBox) throw new Error('Tiles not visible');

        const sourceCenter = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
        const targetCenter = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };

        await this.page.mouse.move(sourceCenter.x, sourceCenter.y);
        await this.page.mouse.down();
        // Move slightly to trigger drag threshold
        await this.page.mouse.move(sourceCenter.x + 10, sourceCenter.y + 10);
        await this.page.waitForTimeout(200);

        // Move to target center
        await this.page.mouse.move(targetCenter.x, targetCenter.y, { steps: 20 });
        await this.page.waitForTimeout(500);
        await this.page.mouse.up();

        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
    }

    async dragToMerge(linkTitle: string, folderName: string) {
        const link = this.getLinkTile(linkTitle);
        const folder = this.getFolderTile(folderName);

        const linkBox = await link.boundingBox();
        const folderBox = await folder.boundingBox();
        if (!linkBox || !folderBox) throw new Error('Tiles not visible');

        const linkCenter = { x: linkBox.x + linkBox.width / 2, y: linkBox.y + linkBox.height / 2 };
        const folderCenter = { x: folderBox.x + folderBox.width / 2, y: folderBox.y + folderBox.height / 2 };

        // For merging, we use .dragTo but with our custom steps to ensure events fire
        await link.hover();
        await this.page.mouse.down();
        await this.page.mouse.move(linkCenter.x + 10, linkCenter.y + 10);
        await this.page.waitForTimeout(200);

        // Move into the folder and stay there
        await this.page.mouse.move(folderCenter.x, folderCenter.y, { steps: 20 });
        await this.page.waitForTimeout(500);
        await this.page.mouse.up();

        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
    }

    async useAltArrowToReorder(title: string, direction: 'Left' | 'Right' | 'Up' | 'Down', kind: 'link' | 'folder' = 'link') {
        const tile = kind === 'link' ? this.getLinkTile(title) : this.getFolderTile(title);
        // Find the interactive element inside the tile
        const interactive = tile.locator('a, button').first();
        await interactive.focus();
        await this.page.keyboard.down('Alt');
        await this.page.keyboard.press(`Arrow${direction}`);
        await this.page.keyboard.up('Alt');
        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(1000);
    }
}
