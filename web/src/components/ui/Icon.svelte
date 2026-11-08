<script lang="ts">
  type Props = { name: 'agenda' | 'contacts' | 'templates' | 'data' | 'key' | 'close' | 'check' | 'info' | 'warning' };
  let { name }: Props = $props();
  const paths = {
    agenda: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 10h3m-3 4h7',
    contacts: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.87a4 4 0 0 1 0 7.75',
    templates: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h5',
    data: 'M20 6c0 2.2-3.6 4-8 4S4 8.2 4 6s3.6-4 8-4 8 1.8 8 4Zm0 0v12c0 2.2-3.6 4-8 4s-8-1.8-8-4V6m16 6c0 2.2-3.6 4-8 4s-8-1.8-8-4',
    key: 'm15 7 2 2m-5 3-9 9H1v-3l9-9m11-3a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
    close: 'm6 6 12 12M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    info: 'M12 8h.01M11 12h1v4m10-4a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    warning: 'M12 9v4m0 4h.01M10 3 1 19a1 1 0 0 0 1 2h20a1 1 0 0 0 1-2L14 3a2 2 0 0 0-4 0Z',
  };
</script>

<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
  <path d={paths[name]} />
</svg>
