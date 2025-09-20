#!/usr/bin/env python3
"""
Test Alert Deduplication System
Verify 5-minute deduplication works correctly
"""

import asyncio
import sys
import os
import time

# Add coinglass-system to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'coinglass-system'))

from app.core.alert_dedup import is_duplicate_alert, is_duplicate_status

async def test_alert_deduplication():
    """Test alert deduplication functionality"""
    
    print("🧪 Testing Alert Deduplication System")
    print("=" * 50)
    
    # Test 1: First alert should NOT be duplicate
    print("\n📊 Test 1: First BTC accumulation alert")
    is_dup_1 = is_duplicate_alert("BTC", "accumulation", "1h")
    print(f"✅ First alert duplicate? {is_dup_1} (should be False)")
    
    # Test 2: Immediate second alert SHOULD be duplicate
    print("\n📊 Test 2: Immediate second BTC accumulation alert")
    is_dup_2 = is_duplicate_alert("BTC", "accumulation", "1h")
    print(f"✅ Second alert duplicate? {is_dup_2} (should be True)")
    
    # Test 3: Different coin should NOT be duplicate
    print("\n📊 Test 3: ETH accumulation alert (different coin)")
    is_dup_3 = is_duplicate_alert("ETH", "accumulation", "1h")
    print(f"✅ ETH alert duplicate? {is_dup_3} (should be False)")
    
    # Test 4: Same coin, different signal type should NOT be duplicate
    print("\n📊 Test 4: BTC distribution alert (different signal)")
    is_dup_4 = is_duplicate_alert("BTC", "distribution", "1h")
    print(f"✅ BTC distribution duplicate? {is_dup_4} (should be False)")
    
    # Test 5: Status deduplication
    print("\n📊 Test 5: Status message deduplication")
    status_dup_1 = is_duplicate_status("started")
    print(f"✅ First 'started' status duplicate? {status_dup_1} (should be False)")
    
    status_dup_2 = is_duplicate_status("started")
    print(f"✅ Second 'started' status duplicate? {status_dup_2} (should be True)")
    
    # Results summary
    print("\n" + "=" * 50)
    print("📈 DEDUPLICATION TEST SUMMARY:")
    print(f"• First BTC alert:     {'❌' if is_dup_1 else '✅'} (correct: not duplicate)")
    print(f"• Second BTC alert:    {'✅' if is_dup_2 else '❌'} (correct: IS duplicate)")
    print(f"• ETH alert:           {'❌' if is_dup_3 else '✅'} (correct: not duplicate)")
    print(f"• BTC distribution:    {'❌' if is_dup_4 else '✅'} (correct: not duplicate)")
    print(f"• First status:        {'❌' if status_dup_1 else '✅'} (correct: not duplicate)")
    print(f"• Second status:       {'✅' if status_dup_2 else '❌'} (correct: IS duplicate)")
    
    # Overall result
    all_tests_passed = (
        not is_dup_1 and  # First alert should NOT be duplicate
        is_dup_2 and      # Second alert SHOULD be duplicate
        not is_dup_3 and  # Different coin should NOT be duplicate
        not is_dup_4 and  # Different signal should NOT be duplicate
        not status_dup_1 and  # First status should NOT be duplicate
        status_dup_2       # Second status SHOULD be duplicate
    )
    
    if all_tests_passed:
        print("\n🎉 ALL DEDUPLICATION TESTS PASSED!")
        return True
    else:
        print("\n❌ Some deduplication tests failed")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_alert_deduplication())
    sys.exit(0 if success else 1)