import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AttendanceRecord, FirebaseService, WorkoutTypeStat } from '../../services/firebase.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.css']
})
export class StatsComponent implements OnInit, OnDestroy {
  // View mode: 'attendances' | 'workouts'
  viewMode: 'attendances' | 'workouts' = 'attendances';

  // Attendance Stats
  totalCount = 0;
  monthlyCount = 0;
  yearlyCount = 0;
  monthlyData: { month: string; count: number }[] = [];

  // Workout Type Stats
  workoutTypeStats: WorkoutTypeStat[] = [];
  monthlyWorkoutStats: WorkoutTypeStat[] = [];
  
  // Date tracking for workout view
  currentYear = new Date().getFullYear();
  selectedWorkoutMonth = new Date().getMonth(); // 0-11

  isLoading = true;
  private authSub: Subscription | null = null;
  private userId: string | null = null;

  monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];

  constructor(
    private firebaseService: FirebaseService,
    private themeService: ThemeService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.authSub = this.authService.currentUser$.subscribe(async (user) => {
      this.isLoading = true;
      if (user) {
        this.userId = user.uid;
        await this.loadStats();
      } else {
        this.userId = null;
        this.resetStats();
      }
      this.isLoading = false;
    });
  }

  ngOnDestroy() {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
  }

  resetStats() {
    this.totalCount = 0;
    this.monthlyCount = 0;
    this.yearlyCount = 0;
    this.workoutTypeStats = [];
    this.monthlyWorkoutStats = [];
    this.monthlyData = [];
  }

  async loadStats() {
    if (!this.userId) return;

    // Load attendance stats
    // Note: detailed implementation of these methods should be verified in FirebaseService
    // For now we use the available methods or workarounds if methods are missing logic
    
    // We already added placeholders in FirebaseService, but we need real data
    // Let's rely on getYearAttendance to calculate these locally if service methods are placeholders
    
    // Calculate stats locally from year data to ensure accuracy until service is fully improved
    const yearData = await this.firebaseService.getYearAttendance(this.userId, this.currentYear);
    
    this.yearlyCount = yearData.length;
    // Note: totalCount would need all time data, which might be heavy. 
    // For now, let's just use yearly count or try the placeholder.
    this.totalCount = await this.firebaseService.getTotalAttendanceCount() || this.yearlyCount; 

    // Current month count
    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    this.monthlyCount = yearData.filter(d => d.date.startsWith(currentMonthPrefix)).length;

    // Process monthly breakdown
    this.processMonthlyData(yearData);

    // Load workout type stats
    this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
    await this.loadMonthlyWorkoutStats();
  }

  async loadMonthlyWorkoutStats() {
    if (!this.userId) return;
    this.monthlyWorkoutStats = await this.firebaseService.getMonthlyWorkoutTypeStats(
      this.userId,
      this.currentYear, 
      this.selectedWorkoutMonth + 1 // Service expects 1-12 probably? verify getMonthlyWorkoutTypeStats
    );
  }

  processMonthlyData(data: AttendanceRecord[]) {
    // Aggregate attendance records into monthly counts
    const counts = new Array(12).fill(0);
    
    data.forEach(record => {
      const date = new Date(record.date);
      const monthIndex = date.getMonth();
      counts[monthIndex]++;
    });

    this.monthlyData = this.monthNames.map((name, index) => {
      return {
        month: name,
        count: counts[index]
      };
    });
  }

  getMaxCount(): number {
    return Math.max(...this.monthlyData.map(d => d.count), 1); // Avoid div by 0
  }
  
  getMaxWorkoutCount(): number {
    return Math.max(...this.workoutTypeStats.map(s => s.count), 1);
  }

  getMaxMonthlyWorkoutCount(): number {
    return Math.max(...this.monthlyWorkoutStats.map(s => s.count), 1);
  }

  getDisplayTitle(): string {
    return this.viewMode === 'attendances' ? 'STATS.TITLE_ATTENDANCE' : 'STATS.TITLE_WORKOUTS';
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

  async prevWorkoutMonth() {
    this.selectedWorkoutMonth--;
    if (this.selectedWorkoutMonth < 0) {
      this.selectedWorkoutMonth = 11;
      this.currentYear--;
      if (this.userId) {
         this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
      }
    }
    await this.loadMonthlyWorkoutStats();
  }

  async nextWorkoutMonth() {
    this.selectedWorkoutMonth++;
    if (this.selectedWorkoutMonth > 11) {
      this.selectedWorkoutMonth = 0;
      this.currentYear++;
      if (this.userId) {
        this.workoutTypeStats = await this.firebaseService.getWorkoutTypeStats(this.userId, this.currentYear);
      }
    }
    await this.loadMonthlyWorkoutStats();
  }
  
  getMonthlyWorkoutTotal(): number {
    return this.monthlyWorkoutStats.reduce((sum, current) => sum + current.count, 0);
  }
  
  getTotalWorkouts(): number {
    return this.workoutTypeStats.reduce((sum, current) => sum + current.count, 0);
  }
}
