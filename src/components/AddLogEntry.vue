<template>
    <div class="AddLogEntry">
      
      <h1>Add Entry</h1>
      <h2 class="msg">{{ msg }}</h2>
      <form method="post">
        <label for="txtCallsign">Call</label>
        <input type="text" name="callsign" id="txtCallsign" />
        <label for="txtClass">Class</label>
        <input type="text" name="class" id="txtClass" />
        <label for="txtSection">Section</label>
        <input type="text" name="section" id="txtSection" />
        <button type="submit">Add</button>
      </form>
    </div>
  </template>
  
  <script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    name: 'AddLogEntry',
    props: {
      msg: String,
      callsign: String,
      class: String,
      section: String,
    },
  });
  </script>
  
  <!-- Add "scoped" attribute to limit CSS to this component only -->
  <style scoped lang="scss">
  h3 {
    margin: 40px 0 0;
  }
  ul {
    list-style-type: none;
    padding: 0;
  }
  li {
    display: inline-block;
    margin: 0 10px;
  }
  a {
    color: #42b983;
  }
  </style>
  