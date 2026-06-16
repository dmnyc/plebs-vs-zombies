<template>
  <div class="max-w-2xl mx-auto">
    <div class="card">
      <ZombieCheck />
    </div>
  </div>
</template>

<script>
import ZombieCheck from '../components/ZombieCheck.vue';

export default {
  name: 'ZombieCheckView',
  components: { ZombieCheck }
};
</script>
