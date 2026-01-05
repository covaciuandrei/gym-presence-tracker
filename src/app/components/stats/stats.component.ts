import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AttendanceRecord, FirebaseService, TrainingType } from '../../services/firebase.service';

interface WorkoutTypeStat {
  id: string;
  name: string;
  icon: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit, OnDestroy {
  viewMode: 'attendances' | 'workouts' = 'attendances';
  currentDate = new Date();
  currentYear: number;
  currentMonth: number;
  
  monthlyCount = 0;
  yearlyCount = 0;
  totalCount = 0;
  
  // Monthly stats
  monthlyData: { month: string; count: number }[] = [];
  
  // Workout type stats
  workoutTypes: TrainingType[] = [];
  workoutTypeStats: WorkoutTypeStat[] = [];  // Yearly
  monthlyWorkoutStats: WorkoutTypeStat[] = []; // Monthly
  yearRecords: AttendanceRecord[] = [];
  selectedWorkoutMonth: number;
  
  isLoading = false;

  private authSub: Subscription | null = null;
  private userId: string | null = null;

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService
  ) {
    this.currentYear = this.currentDate.getFullYear();
    this.currentMonth = this.currentDate.getMonth();
    this.selectedWorkoutMonth = this.currentMonth;
  }

  ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe(async user => {
      if (user) {
        this.userId = user.uid;
        await this.loadWorkoutTypes();
        await this.loadStats();
      }
    });
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  async loadWorkoutTypes() {
    if (!this.userId) return;
    try {
      this.workoutTypes = await this.firebaseService.getTrainingTypes(this.userId);
    } catch (error) {
      console.error('Error loading workout types:', error);
    }
  }

  async loadStats() {
    if (!this.userId) return;

    this.isLoading = true;
    try {
      // Load year data
      this.yearRecords = await this.firebaseService.getYearAttendance(this.userId, this.currentYear);
      const allDates = this.yearRecords.map(r => r.date);
      
      // Current year count
      this.yearlyCount = allDates.length;
      
      // Current month count
      const currentMonthStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
      this.monthlyCount = allDates.filter(date => date.startsWith(currentMonthStr)).length;
      
      // Monthly breakdown for the year
      this.monthlyData = [];
      for (let i = 0; i < 12; i++) {
        const monthStr = `${this.currentYear}-${String(i + 1).padStart(2, '0')}`;
        const count = allDates.filter(date => date.startsWith(monthStr)).length;
        this.monthlyData.push({
          month: this.monthNames[i],
          count
        });
      }

      // Calculate total (this year's data only for efficiency)
      this.totalCount = this.yearlyCount;
      
      // Calculate workout type stats
      this.calculateWorkoutTypeStats();
    } catch (error) {
      console.error('Error loading stats:', error);
    }
    this.isLoading = false;
  }

  calculateWorkoutTypeStats() {
    // Count by workout type
    const typeCounts = new Map<string, number>();
    let noTypeCount = 0;
    
    for (const record of this.yearRecords) {
      if (record.trainingTypeId) {
        typeCounts.set(record.trainingTypeId, (typeCounts.get(record.trainingTypeId) || 0) + 1);
      } else {
        noTypeCount++;
      }
    }
    
    // Build stats array
    this.workoutTypeStats = [];
    
    for (const type of this.workoutTypes) {
      const count = typeCounts.get(type.id) || 0;
      if (count > 0) {
        this.workoutTypeStats.push({
          id: type.id,
          name: type.name,
          icon: type.icon || '🏋️',
          count,
          color: type.color || '#6366f1'
        });
      }
    }
    
    // Add "No type" if any
    if (noTypeCount > 0) {
      this.workoutTypeStats.push({
        id: 'none',
        name: 'No type',
        icon: '❓',
        count: noTypeCount,
        color: '#94a3b8'
      });
    }
    
    // Sort by count descending
    this.workoutTypeStats.sort((a, b) => b.count - a.count);
    
    // Calculate monthly stats
    this.calculateMonthlyWorkoutStats();
  }

  calculateMonthlyWorkoutStats() {
    const monthStr = `${this.currentYear}-${String(this.selectedWorkoutMonth + 1).padStart(2, '0')}`;
    const monthRecords = this.yearRecords.filter(r => r.date.startsWith(monthStr));
    
    const typeCounts = new Map<string, number>();
    let noTypeCount = 0;
    
    for (const record of monthRecords) {
      if (record.trainingTypeId) {
        typeCounts.set(record.trainingTypeId, (typeCounts.get(record.trainingTypeId) || 0) + 1);
      } else {
        noTypeCount++;
      }
    }
    
    this.monthlyWorkoutStats = [];
    
    for (const type of this.workoutTypes) {
      const count = typeCounts.get(type.id) || 0;
      if (count > 0) {
        this.monthlyWorkoutStats.push({
          id: type.id,
          name: type.name,
          icon: type.icon || '🏋️',
          count,
          color: type.color || '#6366f1'
        });
      }
    }
    
    if (noTypeCount > 0) {
      this.monthlyWorkoutStats.push({
        id: 'none',
        name: 'No type',
        icon: '❓',
        count: noTypeCount,
        color: '#94a3b8'
      });
    }
    
    this.monthlyWorkoutStats.sort((a, b) => b.count - a.count);
  }

  prevWorkoutMonth() {
    this.selectedWorkoutMonth--;
    if (this.selectedWorkoutMonth < 0) {
      this.selectedWorkoutMonth = 11;
      this.currentYear--;
      this.loadStats();
    } else {
      this.calculateMonthlyWorkoutStats();
    }
  }

  nextWorkoutMonth() {
    this.selectedWorkoutMonth++;
    if (this.selectedWorkoutMonth > 11) {
      this.selectedWorkoutMonth = 0;
      this.currentYear++;
      this.loadStats();
    } else {
      this.calculateMonthlyWorkoutStats();
    }
  }

  getMonthlyWorkoutTotal(): number {
    return this.monthlyWorkoutStats.reduce((sum, stat) => sum + stat.count, 0);
  }

  getMaxMonthlyWorkoutCount(): number {
    if (this.monthlyWorkoutStats.length === 0) return 1;
    return Math.max(...this.monthlyWorkoutStats.map(d => d.count), 1);
  }

  toggleView(mode: 'attendances' | 'workouts') {
    this.viewMode = mode;
  }

  async previousPeriod() {
    this.currentYear--;
    await this.loadStats();
  }

  async nextPeriod() {
    this.currentYear++;
    await this.loadStats();
  }

  getDisplayTitle(): string {
    return `${this.currentYear}`;
  }

  getMaxCount(): number {
    if (this.monthlyData.length === 0) return 1;
    return Math.max(...this.monthlyData.map(d => d.count), 1);
  }

  getMaxWorkoutCount(): number {
    if (this.workoutTypeStats.length === 0) return 1;
    return Math.max(...this.workoutTypeStats.map(d => d.count), 1);
  }

  getTotalWorkouts(): number {
    return this.workoutTypeStats.reduce((sum, stat) => sum + stat.count, 0);
  }
}
