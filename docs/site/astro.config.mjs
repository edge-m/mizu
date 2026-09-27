// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Mizu',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/edge-m/mizu' }],
			sidebar: [
				{
					label: 'Start here',
					items: [{ slug: 'guides/quickstart' }, { slug: 'concepts/architecture' }],
				},
				{
					label: 'Guides',
					items: [{ autogenerate: { directory: 'guides' } }],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
				{ label: 'Contributing', items: [{ slug: 'contributing' }] },
			],
		}),
	],
});
