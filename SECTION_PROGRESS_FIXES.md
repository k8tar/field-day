# Section Progress Component ARRL Section Fixes

## Issue
The Section Progress and Section Map components were displaying invalid ARRL sections:
- "FL" instead of proper Florida subsections (NFL, SFL)
- "TX" instead of proper Texas subsections (NTX, STX, WTX)
- Invalid sections like "NYC", "VI", "WCF"
- Sections placed in wrong divisions

## Changes Made

### SectionProgress.vue and SectionMap.vue

#### 1. Fixed Florida Sections
**Before:**
```javascript
'Southeastern (4)': {
  sections: ['FL', 'GA', 'NC', 'NFL', 'SC', 'SFL', 'VI', 'WCF']
}
```

**After:**
```javascript
'Southeastern (4)': {
  sections: ['AL', 'GA', 'NFL', 'SFL']
}
```

#### 2. Added Missing Roanoke Division
**Added:**
```javascript
'Roanoke (4)': {
  sections: ['NC', 'SC', 'VA', 'WV']
}
```

#### 3. Fixed Texas Sections
**Before:**
```javascript
'Southwestern (5)': {
  sections: ['AZ', 'TX']
},
'West Gulf (5)': {
  sections: ['NTX', 'OK', 'STX']
}
```

**After:**
```javascript
'Southwestern (5)': {
  sections: ['AZ', 'NV']
},
'West Gulf (5)': {
  sections: ['NTX', 'OK', 'STX', 'WTX']
}
```

#### 4. Fixed Hudson Division
**Before:**
```javascript
'Hudson (2)': {
  sections: ['ENY', 'NNY', 'NYC', 'WNY']
}
```

**After:**
```javascript
'Hudson (2)': {
  sections: ['ENY', 'NNY', 'WNY']  // Removed invalid NYC
}
```

#### 5. Fixed Pacific Division
**Before:**
```javascript
'Pacific (6)': {
  sections: ['EB', 'LAX', 'ORG', 'SB', 'SC', 'SCV', 'SDG', 'SF', 'SJV', 'SV']
}
```

**After:**
```javascript
'Pacific (6)': {
  sections: ['EB', 'LAX', 'ORG', 'SB', 'SCV', 'SDG', 'SF', 'SJV', 'SV']  // Removed SC
}
```

#### 6. Fixed Rocky Mountain Division
**Before:**
```javascript
'Rocky Mountain (0)': {
  sections: ['CO', 'NM', 'NV', 'UT', 'WY']
}
```

**After:**
```javascript
'Rocky Mountain (0)': {
  sections: ['CO', 'NM', 'UT', 'WY']  // Moved NV to Southwestern
}
```

## Results

✅ **Florida properly broken out**: NFL (Northern Florida), SFL (Southern Florida)
✅ **Texas properly broken out**: NTX (North Texas), STX (South Texas), WTX (West Texas)  
✅ **All sections match official ARRL list**
✅ **Sections in correct divisions**
✅ **Invalid sections removed**: FL, TX, NYC, VI, WCF

## Validation

All sections now match the official `ARRL_SECTIONS` array from `/src/constants/arrl-sections.ts` and will validate properly when used in QSO logging.
