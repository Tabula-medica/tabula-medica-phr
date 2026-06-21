import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Apple, Droplets, Plus, Flame, Utensils, Coffee, Moon as Dinner, Cookie, TrendingUp, TrendingDown, Target } from "lucide-react";
import { format } from "date-fns";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from "recharts";
type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

interface NutritionEntry {
  id: string;
  patientId: string;
  date: string;
  mealType: MealType;
  mealTime: string;
  foodItems: {
    name: string;
    portion: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sodium?: number;
  }[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  waterIntakeOz?: number;
  notes?: string;
  photoUrl?: string;
  source: "manual" | "device" | "barcode";
  createdAt: string;
  updatedAt: string;
}

const mockNutritionData: NutritionEntry[] = [
  {
    id: "1",
    patientId: "patient-1",
    date: "2026-01-18",
    mealType: "breakfast",
    mealTime: "07:30",
    foodItems: [
      { name: "Oatmeal with berries", portion: "1 bowl", calories: 320, protein: 12, carbs: 54, fat: 6, fiber: 8 },
      { name: "Greek yogurt", portion: "1 cup", calories: 150, protein: 15, carbs: 8, fat: 5 },
      { name: "Coffee with milk", portion: "1 cup", calories: 30, protein: 1, carbs: 3, fat: 1 },
    ],
    totalCalories: 500,
    totalProtein: 28,
    totalCarbs: 65,
    totalFat: 12,
    source: "manual",
    createdAt: "2026-01-18T07:30:00Z",
    updatedAt: "2026-01-18T07:30:00Z",
  },
  {
    id: "2",
    patientId: "patient-1",
    date: "2026-01-18",
    mealType: "lunch",
    mealTime: "12:30",
    foodItems: [
      { name: "Grilled chicken salad", portion: "1 large", calories: 450, protein: 35, carbs: 20, fat: 18, fiber: 6 },
      { name: "Whole wheat bread", portion: "1 slice", calories: 80, protein: 3, carbs: 15, fat: 1, fiber: 2 },
      { name: "Water", portion: "16 oz", calories: 0 },
    ],
    totalCalories: 530,
    totalProtein: 38,
    totalCarbs: 35,
    totalFat: 19,
    waterIntakeOz: 16,
    source: "manual",
    createdAt: "2026-01-18T12:30:00Z",
    updatedAt: "2026-01-18T12:30:00Z",
  },
  {
    id: "3",
    patientId: "patient-1",
    date: "2026-01-18",
    mealType: "snack",
    mealTime: "15:30",
    foodItems: [
      { name: "Apple", portion: "1 medium", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4 },
      { name: "Almonds", portion: "1 oz", calories: 165, protein: 6, carbs: 6, fat: 14 },
    ],
    totalCalories: 260,
    totalProtein: 6.5,
    totalCarbs: 31,
    totalFat: 14.3,
    source: "manual",
    createdAt: "2026-01-18T15:30:00Z",
    updatedAt: "2026-01-18T15:30:00Z",
  },
];

const dailyGoals = {
  calories: 2000,
  protein: 120,
  carbs: 250,
  fat: 65,
  water: 64,
  fiber: 30,
};

const weeklyCalorieData = [
  { day: "Mon", calories: 1850, goal: 2000 },
  { day: "Tue", calories: 2100, goal: 2000 },
  { day: "Wed", calories: 1950, goal: 2000 },
  { day: "Thu", calories: 1780, goal: 2000 },
  { day: "Fri", calories: 2200, goal: 2000 },
  { day: "Sat", calories: 2400, goal: 2000 },
  { day: "Sun", calories: 1290, goal: 2000 },
];

function getMealIcon(mealType: MealType) {
  switch (mealType) {
    case "breakfast":
      return <Coffee className="h-4 w-4 text-amber-500" />;
    case "lunch":
      return <Utensils className="h-4 w-4 text-green-500" />;
    case "dinner":
      return <Dinner className="h-4 w-4 text-blue-500" />;
    case "snack":
      return <Cookie className="h-4 w-4 text-pink-500" />;
    default:
      return <Apple className="h-4 w-4 text-red-500" />;
  }
}

function getMealLabel(mealType: MealType) {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
}

export default function NutritionTrackingPage() {
  const [selectedTab, setSelectedTab] = useState("today");
  
  const todayMeals = mockNutritionData;
  const todayTotals = {
    calories: todayMeals.reduce((sum, m) => sum + (m.totalCalories || 0), 0),
    protein: todayMeals.reduce((sum, m) => sum + (m.totalProtein || 0), 0),
    carbs: todayMeals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0),
    fat: todayMeals.reduce((sum, m) => sum + (m.totalFat || 0), 0),
    water: todayMeals.reduce((sum, m) => sum + (m.waterIntakeOz || 0), 0),
  };

  const macroData = [
    { name: "Protein", value: todayTotals.protein, color: "#ef4444" },
    { name: "Carbs", value: todayTotals.carbs, color: "#3b82f6" },
    { name: "Fat", value: todayTotals.fat, color: "#eab308" },
  ];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="title-nutrition">Nutrition Tracking</h1>
          <p className="text-muted-foreground">Log meals and track your daily nutrition</p>
        </div>
        <Button data-testid="button-log-meal">
          <Plus className="h-4 w-4 mr-2" />
          Log Meal
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Calories</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTotals.calories}</div>
            <Progress value={(todayTotals.calories / dailyGoals.calories) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {dailyGoals.calories} goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Protein</CardTitle>
            <Target className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTotals.protein.toFixed(0)}g</div>
            <Progress value={(todayTotals.protein / dailyGoals.protein) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {dailyGoals.protein}g goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Carbs</CardTitle>
            <Apple className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTotals.carbs.toFixed(0)}g</div>
            <Progress value={(todayTotals.carbs / dailyGoals.carbs) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {dailyGoals.carbs}g goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Fat</CardTitle>
            <TrendingUp className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTotals.fat.toFixed(0)}g</div>
            <Progress value={(todayTotals.fat / dailyGoals.fat) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {dailyGoals.fat}g goal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Water</CardTitle>
            <Droplets className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayTotals.water} oz</div>
            <Progress value={(todayTotals.water / dailyGoals.water) * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">of {dailyGoals.water} oz goal</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="today" data-testid="tab-today">Today</TabsTrigger>
          <TabsTrigger value="macros" data-testid="tab-macros">Macros</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Meals</CardTitle>
              <CardDescription>{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {todayMeals.map((meal) => (
                    <Card key={meal.id} className="hover-elevate" data-testid={`card-meal-${meal.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              {getMealIcon(meal.mealType)}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{getMealLabel(meal.mealType)}</span>
                                <span className="text-sm text-muted-foreground">{meal.mealTime}</span>
                              </div>
                              <div className="space-y-0.5">
                                {meal.foodItems.map((item, idx) => (
                                  <p key={idx} className="text-sm text-muted-foreground">
                                    {item.name} ({item.portion})
                                    {item.calories && <span className="ml-1">- {item.calories} cal</span>}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{meal.totalCalories} cal</div>
                            <div className="flex gap-2 mt-1 text-xs">
                              <Badge variant="outline" className="bg-red-50 dark:bg-red-950">P: {meal.totalProtein}g</Badge>
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950">C: {meal.totalCarbs}g</Badge>
                              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950">F: {meal.totalFat}g</Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  <Button variant="outline" className="w-full" data-testid="button-add-dinner">
                    <Plus className="h-4 w-4 mr-2" />
                    Log Dinner
                  </Button>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="macros" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Macro Distribution</CardTitle>
                <CardDescription>Today's macronutrient breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={macroData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}g`}
                    >
                      {macroData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-4">
                  {macroData.map((macro) => (
                    <div key={macro.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: macro.color }} />
                      <span className="text-sm">{macro.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Goal Progress</CardTitle>
                <CardDescription>How you're tracking against daily goals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Calories</span>
                    <span>{todayTotals.calories} / {dailyGoals.calories}</span>
                  </div>
                  <Progress value={(todayTotals.calories / dailyGoals.calories) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Protein</span>
                    <span>{todayTotals.protein.toFixed(0)}g / {dailyGoals.protein}g</span>
                  </div>
                  <Progress value={(todayTotals.protein / dailyGoals.protein) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Carbs</span>
                    <span>{todayTotals.carbs.toFixed(0)}g / {dailyGoals.carbs}g</span>
                  </div>
                  <Progress value={(todayTotals.carbs / dailyGoals.carbs) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Fat</span>
                    <span>{todayTotals.fat.toFixed(0)}g / {dailyGoals.fat}g</span>
                  </div>
                  <Progress value={(todayTotals.fat / dailyGoals.fat) * 100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Fiber</span>
                    <span>12g / {dailyGoals.fiber}g</span>
                  </div>
                  <Progress value={(12 / dailyGoals.fiber) * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Calorie Intake</CardTitle>
              <CardDescription>Compare your daily intake to your goal</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyCalorieData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calories" fill="#3b82f6" name="Calories" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="goal" fill="#e5e7eb" name="Goal" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nutrition Insights</CardTitle>
              <CardDescription>AI-powered analysis of your eating patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Protein Intake Pattern</p>
                    <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                      Your logs show consistent achievement of protein goals. Nutrition research states that adequate protein refers to a factor that supports muscle maintenance.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
                <div className="flex items-start gap-3">
                  <Droplets className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-400">Hydration Data</p>
                    <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                      Your records show an average of 48 oz of water daily, which means you are below your 64 oz goal. Health guidelines state that adequate hydration refers to an important factor in wellness.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900">
                <div className="flex items-start gap-3">
                  <Apple className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-700 dark:text-blue-400">Fiber Intake Observation</p>
                    <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                      Your nutrition data shows an average fiber intake of 18g daily. Dietary guidelines state that the recommended daily fiber refers to approximately 30g for adults.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-nutrition-tracking-disclaimer" />
    </div>
  );
}