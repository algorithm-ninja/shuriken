'use strict';

// APIs and collections.
import {Contests} from '../api/contests.js';
// UI fragments.
import './contestPicker.html';

 Template.contestPicker.onCreated(function(){
   this.subscribe('AllContests');
 });

 Template.contestPicker.helpers({
   'contests'() {
     return Contests.find();
   },
 });
